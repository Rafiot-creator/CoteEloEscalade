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
  label: 'Glicko (cote + fiabilite)',
  labelCourt: 'Glicko',
  // Glicko bouge plus franchement que l'Elo : a 0,75 il signalerait deux fois
  // plus de blocs pour 4 % de fausses alertes, contre 2,5 % a 1,0.
  seuilDesaccord: 1,
  description:
    "Memes affrontements, sans ponderation du style, mais chaque cote porte son incertitude. Les blocs peu repetes — ceux qui viennent d'etre ouverts — sont signales comme tels au lieu d'etre cotes avec un faux aplomb. Ses cotes sont un peu plus etalees que la convention des 1000 points par cran : passer le calibrage en mode regression les remet a l'echelle.",
  params: [
    {
      nom: 'echelle',
      label: 'Echelle',
      type: 'nombre',
      defaut: ECHELLE_REFERENCE,
      min: 200,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'Base',
      aide: "Ecart de cote qui vaut dix chances contre une de reussir.",
    },
    {
      nom: 'ratingInitial',
      label: 'Cote de repli',
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
      label: 'Ecart au-dela duquel un resultat attendu est ignore',
      type: 'nombre',
      defaut: 2000,
      min: 0,
      max: 5000,
      pas: 250,
      unite: 'pts',
      groupe: 'Base',
      aide: "Meme regle que dans la formule maison : un grimpeur tres au-dessous d'un bloc qui echoue, ou tres au-dessus qui reussit, n'apprend rien et pousse la cote toujours dans le meme sens. La decision est figee au debut de chaque passe, sinon l'ensemble des observations changerait pendant l'iteration vers le point fixe et celle-ci ne convergerait plus. 0 = tout compte.",
    },
    {
      nom: 'rdInitial',
      label: 'Incertitude initiale (RD)',
      type: 'nombre',
      defaut: 600,
      min: 250,
      max: 5000,
      pas: 100,
      unite: 'pts',
      groupe: 'Incertitude',
      aide: "Ce qu'on ignore d'un grimpeur ou d'un bloc qu'on n'a jamais vus. Grand RD = les premiers resultats comptent beaucoup.",
    },
    {
      nom: 'rdMin',
      label: 'Incertitude plancher',
      type: 'nombre',
      defaut: 150,
      min: 50,
      max: 1500,
      pas: 25,
      unite: 'pts',
      groupe: 'Incertitude',
      aide: "En dessous, le systeme se croirait plus sur de lui qu'il ne peut l'etre.",
    },
    {
      nom: 'c',
      label: 'Derive temporelle (c)',
      type: 'nombre',
      defaut: 100,
      min: 0,
      max: 1500,
      pas: 25,
      groupe: 'Incertitude',
      aide: "Incertitude regagnee par periode d'inactivite : un grimpeur qu'on n'a pas vu de l'hiver n'a plus le niveau qu'on lui connaissait. Ne s'applique pas aux blocs, qui ne changent pas.",
    },
    {
      nom: 'dureePeriodeJours',
      label: "Duree d'une periode",
      type: 'nombre',
      defaut: 120,
      min: 14,
      max: 365,
      pas: 7,
      unite: 'jours',
      groupe: 'Periodes',
      aide: "Glicko traite les duels par lots. Periode courte = suivi reactif mais bruite ; periode longue = lissage. Un duel etant deja le repli de plusieurs seances, il en reste peu par grimpeur : des periodes longues valent mieux ici que le trimestre habituel.",
    },
    {
      nom: 'passes',
      label: 'Passes',
      type: 'nombre',
      defaut: 6,
      min: 1,
      max: 25,
      pas: 1,
      groupe: 'Periodes',
      aide: 'Alternances "grimpeurs puis blocs". Surveiller la courbe de convergence.',
    },
    {
      nom: 'amorceGrimpeurs',
      label: 'Amorce des grimpeurs',
      type: 'choix',
      defaut: 'niveau',
      groupe: 'A priori',
      options: [
        { valeur: 'niveau', label: 'Depuis leur niveau (V4 = 4000)' },
        { valeur: 'uniforme', label: 'Tous a la cote de repli' },
      ],
    },
    {
      nom: 'amorce',
      label: 'Amorce des blocs',
      type: 'choix',
      defaut: 'cotation',
      groupe: 'A priori',
      options: [
        { valeur: 'cotation', label: "Depuis la cotation affichee (V1 = 1000, V2 = 2000...)" },
        { valeur: 'uniforme', label: "Uniforme (ignore la cotation de l'ouvreur)" },
      ],
    },
    {
      nom: 'ptsParCran',
      label: 'Points par cran V',
      type: 'nombre',
      defaut: 1000,
      min: 100,
      max: 2000,
      pas: 50,
      unite: 'pts',
      groupe: 'A priori',
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
          valeur: rdMoyenBlocs,
          unite: 'pts',
          basMieux: true,
          aide: "RD moyen. Environ 2 x RD = la marge a 95 % autour de la cote calculee.",
        },
        {
          label: 'Duels ecartes',
          valeur: negliges,
          aide:
            "Resultats attendus entre adversaires trop eloignes, ecartes du calcul. Compte sur la phase d'estimation des grimpeurs ; celle des blocs applique la meme regle.",
        },
        {
          label: 'Periodes de classement',
          valeur: periodes.length,
          aide: 'Nombre de lots temporels traites.',
        },
        diagnosticDuels(affrontements),
      ],
    }
  },
}

export default formule
