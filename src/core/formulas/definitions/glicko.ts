import type { Dataset } from '../../types'
import {
  ECHELLE_REFERENCE,
  Evaluateur,
  amorceBloc,
  amorcesGrimpeurs,
  construireDuels,
  diagnosticDuels,
  etatVide,
  type Duel,
} from '../lib'
import type { EtatRating, Formule, PointHistorique, SortieFormule } from '../types'

const JOUR = 86400000

/** Iterations de Newton pour amener les blocs a leur point fixe, par passe. */
const MAX_ITERATIONS_BLOCS = 25
/** Deplacement (en points) sous lequel on considere les blocs stabilises. */
const SEUIL_POINT_FIXE = 4
/**
 * Pas maximal d'une mise a jour, en points.
 * Quand une entite est tres loin du compte, l'esperance sature : la courbure de
 * la vraisemblance s'effondre et le pas de Newton part a l'infini. Le plafond
 * transforme cette divergence en une marche reguliere.
 */
const PAS_MAX = 1500
/**
 * Lissage des scores : une victoire vaut 0,98 et une defaite 0,02.
 *
 * Sans lui, un bloc que personne n'a jamais rate (ou jamais reussi) a un optimum
 * a l'infini — le gradient de vraisemblance ne s'annule jamais et l'a priori
 * seul ne l'arrete qu'a plusieurs milliers de points. Avec, le bloc se stabilise
 * a environ deux crans du meilleur grimpeur qui l'a fait : une extrapolation
 * prudente plutot qu'une aberration. C'est un cas frequent en salle, ou beaucoup
 * de blocs faciles ne sont jamais rates.
 */
const LISSAGE = 0.02
const lisser = (score: number) => LISSAGE + (1 - 2 * LISSAGE) * score

/**
 * Glicko-1 (Mark Glickman) sur les memes affrontements que la formule maison.
 *
 * Meme modele : un duel par couple grimpeur-bloc, gagne ou perdu. Elle ignore
 * volontairement la ponderation du style — c'est ce qui en fait un point de
 * comparaison propre : si elle donne les memes cotes que la formule ponderee,
 * c'est que la ponderation ne change pas grand-chose.
 *
 * Ce qu'elle ajoute : un *ecart-type* a cote de chaque cote. Un bloc ouvert la
 * semaine derniere et fait par trois personnes n'a pas le meme statut qu'un bloc
 * en place depuis deux mois — le second est une mesure, le premier une
 * estimation. C'est la reponse a "peut-on se fier a ce chiffre ?", question qui
 * se pose sans arret en salle puisque les ouvertures tournent.
 *
 * Deux specificites d'implementation, assumees :
 *  - les periodes de classement sont *temporelles* (par defaut un mois), ce qui
 *    est l'usage prevu par Glicko, et non des passes arbitraires ;
 *  - a chaque passe on re-estime les grimpeurs contre des blocs figes, puis les
 *    blocs contre des grimpeurs figes. Un bloc ne change pas de difficulte avec
 *    le temps, un grimpeur si : toute l'histoire d'un bloc forme donc une seule
 *    periode de classement, alors que celle d'un grimpeur est decoupee.
 */

const q = (echelle: number) => Math.LN10 / echelle

function g(rd: number, qv: number): number {
  return 1 / Math.sqrt(1 + (3 * qv * qv * rd * rd) / (Math.PI * Math.PI))
}

function esperanceGlicko(rating: number, ratingAdv: number, rdAdv: number, qv: number, echelle: number): number {
  return 1 / (1 + Math.pow(10, (-g(rdAdv, qv) * (rating - ratingAdv)) / echelle))
}

interface Accumulateur {
  invD2: number
  delta: number
}

const formule: Formule = {
  id: 'glicko',
  label: 'Glicko (cote + fiabilité)',
  labelEn: 'Glicko (rating + reliability)',
  labelCourt: 'Glicko',
  /*
   * C'est la voix sensible du jury : son role est de rattraper les blocs
   * sous-cotes, que l'Elo laisse passer parce qu'un echec attendu ne le fait
   * presque pas bouger. Le seuil est donc volontairement plus bas que ce que
   * sa seule precision commanderait.
   *
   * Mesure sur le monde temoin, en reunion avec l'Elo a 0,75 :
   *   Glicko a 1,00 : 52 % des sandbags, 2,4 % de fausses alertes, precision 96 %
   *   Glicko a 0,75 : 58 % des sandbags, 3,0 % de fausses alertes, precision 92 %  <- retenu
   *   Glicko a 0,60 : 61 % des sandbags, 5,1 % de fausses alertes, precision 90 %
   * Descendre a 0,60 coute 70 % de fausses alertes en plus pour trois points de
   * detection : le rapport n'y est plus.
   */
  seuilDesaccord: 0.75,
  description:
    "Mêmes affrontements, sans pondération du style, mais chaque cote porte son incertitude. Les blocs peu répétés — ceux qui viennent d'être ouverts — sont signalés comme tels au lieu d'être cotés avec un faux aplomb. Ses cotes sont un peu plus étalées que la convention des 1000 points par cran : passer le calibrage en mode régression les remet à l'échelle.",
  descriptionEn:
    "Same matchups, without style weighting, but every rating carries its own uncertainty. Boulders with few repeats — the ones that just got set — are flagged as such instead of being rated with false confidence. Its ratings are a bit more spread out than the 1000-points-per-grade convention: switching calibration to regression mode rescales them.",
  params: [
    {
      nom: 'echelle',
      label: 'Échelle',
      labelEn: 'Scale',
      type: 'nombre',
      defaut: ECHELLE_REFERENCE,
      min: 200,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'Base',
      aide: "Écart de cote qui vaut dix chances contre une de réussir.",
      aideEn: 'Rating gap worth ten-to-one odds of success.',
    },
    {
      nom: 'ratingInitial',
      label: 'Cote de repli',
      labelEn: 'Fallback rating',
      type: 'nombre',
      defaut: 5000,
      min: 0,
      max: 12000,
      pas: 250,
      unite: 'pts',
      groupe: 'Base',
    },
    {
      nom: 'ecartNeglige',
      label: 'Écart au-delà duquel un résultat attendu est ignoré',
      labelEn: 'Gap beyond which an expected result is ignored',
      type: 'nombre',
      defaut: 2000,
      min: 0,
      max: 5000,
      pas: 250,
      unite: 'pts',
      groupe: 'Base',
      aide: "Même règle que dans la formule maison : un grimpeur très au-dessous d'un bloc qui échoue, ou très au-dessus qui réussit, n'apprend rien et pousse la cote toujours dans le même sens. La décision est figée au début de chaque passe, sinon l'ensemble des observations changerait pendant l'itération vers le point fixe et celle-ci ne convergerait plus. 0 = tout compte.",
      aideEn: "Same rule as the house formula: a climber far below a boulder who fails, or far above one who succeeds, teaches nothing and pushes the rating the same way every time. The decision is frozen at the start of each pass, otherwise the set of observations would change during the iteration toward the fixed point and it would no longer converge. 0 = everything counts.",
    },
    {
      nom: 'rdInitial',
      label: 'Incertitude initiale (RD)',
      labelEn: 'Initial uncertainty (RD)',
      type: 'nombre',
      defaut: 600,
      min: 250,
      max: 5000,
      pas: 100,
      unite: 'pts',
      groupe: 'Incertitude',
      groupeEn: 'Uncertainty',
      aide: "Ce qu'on ignore d'un grimpeur ou d'un bloc qu'on n'a jamais vus. Grand RD = les premiers résultats comptent beaucoup.",
      aideEn: "What we don't know about a climber or boulder we've never seen. High RD = the first results count a lot.",
    },
    {
      nom: 'rdMin',
      label: 'Incertitude plancher',
      labelEn: 'Uncertainty floor',
      type: 'nombre',
      defaut: 150,
      min: 50,
      max: 1500,
      pas: 25,
      unite: 'pts',
      groupe: 'Incertitude',
      groupeEn: 'Uncertainty',
      aide: "En dessous, le système se croirait plus sûr de lui qu'il ne peut l'être.",
      aideEn: "Below this, the system would think itself more confident than it can be.",
    },
    {
      nom: 'c',
      label: 'Dérive temporelle (c)',
      labelEn: 'Time drift (c)',
      type: 'nombre',
      defaut: 100,
      min: 0,
      max: 1500,
      pas: 25,
      groupe: 'Incertitude',
      groupeEn: 'Uncertainty',
      aide: "Incertitude regagnée par période d'inactivité : un grimpeur qu'on n'a pas vu de l'hiver n'a plus le niveau qu'on lui connaissait. Ne s'applique pas aux blocs, qui ne changent pas.",
      aideEn: "Uncertainty regained per period of inactivity: a climber not seen all winter no longer has the level we knew. Does not apply to boulders, which don't change.",
    },
    {
      nom: 'dureePeriodeJours',
      label: "Durée d'une période",
      labelEn: 'Period length',
      type: 'nombre',
      defaut: 120,
      min: 14,
      max: 365,
      pas: 7,
      unite: 'jours',
      uniteEn: 'days',
      groupe: 'Périodes',
      groupeEn: 'Periods',
      aide: "Glicko traite les duels par lots. Période courte = suivi réactif mais bruité ; période longue = lissage. Un duel étant déjà le repli de plusieurs séances, il en reste peu par grimpeur : des périodes longues valent mieux ici que le trimestre habituel.",
      aideEn: "Glicko processes duels in batches. Short period = reactive but noisy tracking; long period = smoothing. Since a duel already folds several sessions together, few remain per climber: long periods work better here than the usual quarter.",
    },
    {
      nom: 'passes',
      label: 'Passes',
      labelEn: 'Passes',
      type: 'nombre',
      defaut: 6,
      min: 1,
      max: 25,
      pas: 1,
      groupe: 'Périodes',
      groupeEn: 'Periods',
      aide: 'Alternances "grimpeurs puis blocs". Surveiller la courbe de convergence.',
      aideEn: '"Climbers then boulders" alternations. Watch the convergence curve.',
    },
    {
      nom: 'amorceGrimpeurs',
      label: 'Amorce des grimpeurs',
      labelEn: 'Climber seeding',
      type: 'choix',
      defaut: 'niveau',
      groupe: 'A priori',
      groupeEn: 'Prior',
      options: [
        { valeur: 'niveau', label: 'Depuis leur niveau (V4 = 4000)', labelEn: 'From their level (V4 = 4000)' },
        { valeur: 'uniforme', label: 'Tous à la cote de repli', labelEn: 'Everyone at the fallback rating' },
      ],
    },
    {
      nom: 'amorce',
      label: 'Amorce des blocs',
      labelEn: 'Boulder seeding',
      type: 'choix',
      defaut: 'cotation',
      groupe: 'A priori',
      groupeEn: 'Prior',
      options: [
        { valeur: 'cotation', label: "Depuis la cotation affichée (V1 = 1000, V2 = 2000...)", labelEn: 'From the displayed grade (V1 = 1000, V2 = 2000...)' },
        { valeur: 'uniforme', label: "Uniforme (ignore la cotation de l'ouvreur)", labelEn: "Uniform (ignores the setter's grade)" },
      ],
    },
    {
      nom: 'ptsParCran',
      label: 'Points par cran V',
      labelEn: 'Points per V grade',
      type: 'nombre',
      defaut: 1000,
      min: 100,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'A priori',
      groupeEn: 'Prior',
    },
  ],

  calculer(dataset: Dataset, p): SortieFormule {
    const ratingInitial = p.ratingInitial as number
    const echelle = p.echelle as number
    const rdInitial = p.rdInitial as number
    const rdMin = p.rdMin as number
    const c = p.c as number
    const dureePeriode = (p.dureePeriodeJours as number) * JOUR
    const passes = Math.max(1, Math.round(p.passes as number))
    const qv = q(echelle)

    const affrontements = construireDuels(dataset.ascensions)
    const retenus = affrontements.duels

    // Decoupage temporel en periodes de classement.
    const periodes: Duel[][] = []
    if (retenus.length) {
      const t0 = retenus[0].t
      for (const d of retenus) {
        const i = Math.floor((d.t - t0) / dureePeriode)
        while (periodes.length <= i) periodes.push([])
        periodes[i].push(d)
      }
    }

    const grimpeurs = new Map<string, EtatRating>()
    const blocs = new Map<string, EtatRating>()
    for (const b of dataset.blocs) {
      blocs.set(
        b.id,
        etatVide(amorceBloc(b.indexOfficiel, ratingInitial, p.ptsParCran as number, p.amorce as string), rdInitial)
      )
    }
    const amorces = amorcesGrimpeurs(
      dataset,
      retenus,
      p.ptsParCran as number,
      ratingInitial,
      p.amorceGrimpeurs as string
    )
    for (const g0 of dataset.grimpeurs) {
      grimpeurs.set(g0.id, etatVide(amorces.get(g0.id) ?? ratingInitial, rdInitial))
    }

    const ecartNeglige = p.ecartNeglige as number

    /**
     * Ce duel etait-il joue d'avance ? `avance` est la cote du grimpeur moins
     * celle du bloc : tres positive et gagne, ou tres negative et perdu, le
     * resultat n'apprend rien — et sa correction va toujours dans le meme sens.
     */
    const jouedAvance = (avance: number, gagne: boolean) =>
      ecartNeglige > 0 && (gagne ? avance >= ecartNeglige : avance <= -ecartNeglige)

    // Les effectifs ne comptent que les duels retenus, et comme la retenue
    // depend des cotes, ils sont recalcules a la derniere passe.

    // Niveau de depart des grimpeurs, raffine d'une passe a l'autre.
    const niveauInitial = new Map<string, number>()
    /** Duels ecartes a la derniere passe, pour le diagnostic. */
    let negliges = 0
    const convergence: number[] = []
    let historique: PointHistorique[] = []
    const evaluateur = new Evaluateur()

    /**
     * Un pas de Newton sur le log-posterieur.
     *
     * `ratingPrior` est le centre de l'a priori. Quand il vaut la cote courante
     * (cas Glicko canonique, une seule mise a jour par periode) le terme d'a
     * priori s'annule et on retrouve la formule du papier. Quand on itere
     * jusqu'au point fixe, il devient indispensable.
     */
    const appliquer = (e: EtatRating, acc: Accumulateur, rdDepart: number, ratingPrior?: number) => {
      if (acc.invD2 <= 0) return
      const inv = 1 / (rdDepart * rdDepart) + acc.invD2
      const rappel = ((ratingPrior ?? e.rating) - e.rating) / (rdDepart * rdDepart)
      const pas = (qv * acc.delta + rappel) / inv
      e.rating += Math.max(-PAS_MAX, Math.min(PAS_MAX, pas))
      e.incertitude = Math.max(rdMin, Math.sqrt(1 / inv))
    }

    for (let passe = 1; passe <= passes; passe++) {
      const dernierePasse = passe === passes
      const cotesBlocsAvant = new Map([...blocs].map(([id, e]) => [id, e.rating]))
      if (dernierePasse) {
        negliges = 0
        for (const e of grimpeurs.values()) {
          e.matchs = 0
          e.reussites = 0
        }
        for (const e of blocs.values()) {
          e.matchs = 0
          e.reussites = 0
        }
      }

      // === Phase A : estimer les grimpeurs, blocs figes =====================
      // Le point de depart n'est pas `ratingInitial` des la 2e passe mais le
      // niveau qu'on leur a trouve *en debut d'historique* : sinon le premier
      // tiers de la chronologie est toujours evalue contre des grimpeurs encore
      // inconnus, et les blocs heritent de cette erreur a chaque passe.
      for (const [id, e] of grimpeurs) {
        e.rating = niveauInitial.get(id) ?? amorces.get(id) ?? ratingInitial
        e.incertitude = rdInitial
      }
      if (dernierePasse) historique = []

      const niveauxParPeriode: Map<string, { rating: number; rd: number }>[] = []

      periodes.forEach((lot, iPeriode) => {
        // Derive : l'incertitude sur un grimpeur croit entre deux periodes.
        for (const e of grimpeurs.values()) {
          e.incertitude = Math.min(rdInitial, Math.sqrt((e.incertitude ?? rdInitial) ** 2 + c * c))
        }

        // Tous les duels de la periode sont evalues contre les cotes *du debut*
        // de periode : c'est ce qui distingue Glicko d'un Elo sequentiel, et ce
        // qui rend l'ordre a l'interieur du lot sans effet.
        const accG = new Map<string, Accumulateur>()
        for (const d of lot) {
          const eg = grimpeurs.get(d.grimpeurId)
          const eb = blocs.get(d.blocId)
          if (!eg || !eb) continue
          if (jouedAvance(eg.rating - eb.rating, d.gagne)) {
            if (dernierePasse) negliges += 1
            continue
          }
          const rdB = eb.incertitude ?? rdInitial
          const s = d.gagne ? 1 : 0
          const attendu = esperanceGlicko(eg.rating, eb.rating, rdB, qv, echelle)
          if (dernierePasse) {
            evaluateur.ajouter(attendu, d.gagne)
            eg.matchs += 1
            if (d.gagne) eg.reussites += 1
          }

          const gB = g(rdB, qv)
          const ag = accG.get(d.grimpeurId) ?? { invD2: 0, delta: 0 }
          ag.invD2 += qv * qv * gB * gB * attendu * (1 - attendu)
          ag.delta += gB * (lisser(s) - attendu)
          accG.set(d.grimpeurId, ag)
        }
        for (const [id, acc] of accG) {
          const e = grimpeurs.get(id)
          if (e) appliquer(e, acc, e.incertitude ?? rdInitial)
        }

        niveauxParPeriode[iPeriode] = new Map(
          [...grimpeurs].map(([id, e]) => [id, { rating: e.rating, rd: e.incertitude ?? rdInitial }])
        )

        if (dernierePasse && lot.length) {
          const t = lot[lot.length - 1].t
          for (const id of new Set(lot.map((d) => d.grimpeurId))) {
            const e = grimpeurs.get(id)
            if (e) historique.push({ grimpeurId: id, t, rating: e.rating })
          }
        }
      })

      // === Phase B : estimer les blocs, grimpeurs figes ======================
      // Un bloc ne vieillit pas : toute son histoire forme une seule periode de
      // classement. On accumule donc ses duels sur toute la chronologie, chacun
      // contre le niveau qu'avait le grimpeur ce jour-la.
      // La retenue est decidee ici, une fois, sur les cotes de debut de passe :
      // si elle etait reevaluee a chaque iteration de Newton, l'ensemble des
      // observations changerait en cours de route et le point fixe n'existerait
      // plus.
      const duelsBlocs: { blocId: string; rG: number; rdG: number; s: number }[] = []
      periodes.forEach((lot, iPeriode) => {
        const niveaux = niveauxParPeriode[iPeriode]
        for (const d of lot) {
          const ng = niveaux?.get(d.grimpeurId)
          const eb = blocs.get(d.blocId)
          if (!ng || !eb) continue
          if (jouedAvance(ng.rating - (cotesBlocsAvant.get(d.blocId) ?? eb.rating), d.gagne)) continue
          if (dernierePasse) {
            eb.matchs += 1
            if (d.gagne) eb.reussites += 1
          }
          duelsBlocs.push({ blocId: d.blocId, rG: ng.rating, rdG: ng.rd, s: d.gagne ? 1 : 0 })
        }
      })

      // Un bloc cumule des dizaines d'observations : un seul pas de Newton ne
      // suffit pas a l'amener a son maximum de vraisemblance quand il en part
      // loin. On itere jusqu'au point fixe.
      for (let iteration = 0; iteration < MAX_ITERATIONS_BLOCS; iteration++) {
        const accB = new Map<string, Accumulateur>()
        for (const m of duelsBlocs) {
          const eb = blocs.get(m.blocId)
          if (!eb) continue
          const attendu = esperanceGlicko(eb.rating, m.rG, m.rdG, qv, echelle)
          const gG = g(m.rdG, qv)
          const ab = accB.get(m.blocId) ?? { invD2: 0, delta: 0 }
          ab.invD2 += qv * qv * gG * gG * attendu * (1 - attendu)
          ab.delta += gG * (lisser(1 - m.s) - attendu)
          accB.set(m.blocId, ab)
        }

        let deplacementMax = 0
        for (const [id, acc] of accB) {
          const e = blocs.get(id)
          if (!e) continue
          const avant = e.rating
          e.incertitude = rdInitial
          appliquer(e, acc, rdInitial, cotesBlocsAvant.get(id))
          deplacementMax = Math.max(deplacementMax, Math.abs(e.rating - avant))
        }
        if (deplacementMax < SEUIL_POINT_FIXE) break
      }

      // Le niveau de la 1re periode devient l'amorce de la passe suivante.
      const premierePeriode = niveauxParPeriode[0]
      if (premierePeriode) {
        for (const [id, n] of premierePeriode) niveauInitial.set(id, n.rating)
      }

      let ecart = 0
      for (const [id, e] of blocs) ecart += Math.abs(e.rating - (cotesBlocsAvant.get(id) ?? e.rating))
      convergence.push(blocs.size ? ecart / blocs.size : 0)
    }

    const rdMoyenBlocs = blocs.size
      ? [...blocs.values()].reduce((s, e) => s + (e.incertitude ?? 0), 0) / blocs.size
      : 0

    return {
      grimpeurs,
      blocs,
      historique,
      convergence,
      diagnostics: [
        ...evaluateur.diagnostics(),
        {
          label: 'Incertitude moyenne des blocs',
          labelEn: 'Average boulder uncertainty',
          valeur: rdMoyenBlocs,
          unite: 'pts',
          basMieux: true,
          aide: "RD moyen. Environ 2 x RD = la marge à 95 % autour de la cote calculée.",
          aideEn: 'Average RD. Roughly 2 x RD = the 95% margin around the calculated rating.',
        },
        {
          label: 'Duels écartés',
          labelEn: 'Excluded duels',
          valeur: negliges,
          aide:
            "Résultats attendus entre adversaires trop éloignés, écartés du calcul. Compte sur la phase d'estimation des grimpeurs ; celle des blocs applique la même règle.",
          aideEn: "Expected results between opponents too far apart, excluded from the calculation. Counted during the climber-estimation phase; the boulder phase applies the same rule.",
        },
        {
          label: 'Périodes de classement',
          labelEn: 'Rating periods',
          valeur: periodes.length,
          aide: 'Nombre de lots temporels traités.',
          aideEn: 'Number of time batches processed.',
        },
        diagnosticDuels(affrontements),
      ],
    }
  },
}

export default formule
