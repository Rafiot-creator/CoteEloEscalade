import type { Ascension, Dataset } from '../types'
import type { Diagnostic, EtatRating, PointHistorique, SortieFormule } from './types'

/**
 * Briques partagees par les formules. Ce qui est ici est teste une fois
 * (`src/core/core.test.ts`) et ne se re-ecrit pas dans chaque module.
 */

/**
 * Echelle de reference : 1000 points d'ecart = 10 chances contre 1.
 *
 * C'est la definition de l'unite. Avec E = 1 / (1 + 10^(-D/echelle)), la cote
 * d'un match vaut E / (1 - E) = 10^(D/echelle) : poser echelle = 1000 fait donc
 * qu'un ecart de 1000 points vaut exactement une cote de 10 contre 1, soit
 * 90,9 % de reussite. (La convention des echecs, 400, place ce meme rapport a
 * 400 points d'ecart.)
 */
export const ECHELLE_REFERENCE = 1000

/** Esperance de reussite du grimpeur A face a un bloc B (logistique Elo). */
export function esperance(ratingA: number, ratingB: number, echelle: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / echelle))
}

/** Cote d'un affrontement : 10 signifie "dix fois plus de chances de reussir". */
export function cote(ratingA: number, ratingB: number, echelle: number): number {
  return Math.pow(10, (ratingA - ratingB) / echelle)
}

/**
 * Facteur K decroissant : un grimpeur avec 200 blocs au compteur ne doit plus
 * bouger autant qu'un debutant. `demiVie` = nombre de matchs au bout duquel K
 * est divise par deux.
 */
export function kEffectif(k: number, kMin: number, demiVie: number, matchs: number): number {
  if (demiVie <= 0) return k
  return Math.max(kMin, k / (1 + matchs / demiVie))
}

// --- Les affrontements ------------------------------------------------------

/**
 * Un duel : *une* partie entre un grimpeur et un bloc, et une seule.
 *
 * Toutes les seances d'un meme couple se replient ici. L'issue ne depend pas du
 * nombre d'essais : le grimpeur a fini par l'envoyer (il gagne) ou il ne l'a
 * jamais envoye (il perd). Le nombre d'essais est conserve, non pour decider de
 * l'issue, mais pour la ponderer : un flash et un enchainement au vingtieme
 * essai ne disent pas la meme chose du rapport de force.
 */
export interface Duel {
  grimpeurId: string
  blocId: string
  /** Date a laquelle l'issue devient definitive : l'envoi, ou la derniere tentative. */
  t: number
  gagne: boolean
  /** Date de la premiere seance infructueuse, s'il y en a eu une. */
  tPremierEchec: number | null
  /** Date de l'envoi, si le bloc a fini par tomber. */
  tEnvoi: number | null
  /** Essais cumules jusqu'a l'envoi, ou sur l'ensemble des tentatives sinon. */
  essais: number
  /** Nombre de seances passees sur ce bloc. */
  seances: number
}

export interface Affrontements {
  duels: Duel[]
  /** Lignes de l'historique repliees dans ces duels. */
  lignes: number
}

/**
 * Replie l'historique en duels, un par couple grimpeur-bloc.
 *
 * Les lignes posterieures au premier envoi sont ignorees : elles n'apportent
 * rien (le duel est deja gagne) et compteraient une seconde fois la meme
 * information. Les echecs repetes, eux, ne comptent pas non plus separement —
 * ils font partie du meme duel, perdu.
 *
 * `ascensions` doit etre trie chronologiquement (le Dataset le garantit).
 */
export function construireDuels(ascensions: Ascension[]): Affrontements {
  const parCouple = new Map<string, Duel>()

  for (const a of ascensions) {
    const cle = a.grimpeurId + '|' + a.blocId
    const duel = parCouple.get(cle)

    if (!duel) {
      const reussi = a.resultat === 'reussite'
      parCouple.set(cle, {
        grimpeurId: a.grimpeurId,
        blocId: a.blocId,
        t: a.t,
        gagne: reussi,
        tPremierEchec: reussi ? null : a.t,
        tEnvoi: reussi ? a.t : null,
        essais: a.essais,
        seances: 1,
      })
      continue
    }

    // Duel deja gagne : la suite est de l'echauffement, elle ne rejoue rien.
    if (duel.gagne) continue

    duel.essais += a.essais
    duel.seances += 1
    duel.t = a.t
    if (a.resultat === 'reussite') {
      duel.gagne = true
      duel.tEnvoi = a.t
    }
  }

  const duels = [...parCouple.values()].sort((x, y) => x.t - y.t)
  return { duels, lignes: ascensions.length }
}

/**
 * Un moment ou les cotes bougent.
 *
 * Le classement ne se contente pas d'enregistrer l'issue finale d'un duel : il
 * la joue au fur et a mesure. Des la premiere seance infructueuse, le grimpeur
 * a perdu — ses points partent au bloc. S'il finit par l'envoyer, cette defaite
 * lui est *rendue* et remplacee par une victoire ponderee par le travail.
 *
 * Un duel produit donc un ou deux evenements :
 *  - envoye du premier coup  -> une victoire ;
 *  - echoue puis envoye      -> une defaite, puis une victoire qui annule la
 *                               defaite et la remplace ;
 *  - jamais envoye           -> une defaite, definitive.
 */
export interface Evenement {
  duel: Duel
  t: number
  type: 'defaite' | 'victoire'
  /** Vrai pour le premier evenement du duel : c'est lui qui compte l'effectif. */
  premier: boolean
  /** La victoire doit-elle d'abord rembourser une defaite deja jouee ? */
  annuleDefaite: boolean
}

export function construireEvenements(duels: Duel[]): Evenement[] {
  const evenements: Evenement[] = []
  for (const duel of duels) {
    const aEchoue = duel.tPremierEchec !== null
    if (aEchoue) {
      evenements.push({ duel, t: duel.tPremierEchec as number, type: 'defaite', premier: true, annuleDefaite: false })
    }
    if (duel.gagne) {
      evenements.push({
        duel,
        t: duel.tEnvoi as number,
        type: 'victoire',
        premier: !aEchoue,
        annuleDefaite: aEchoue,
      })
    }
  }
  return evenements.sort((a, b) => a.t - b.t || (a.type === 'defaite' ? -1 : 1))
}

export function diagnosticDuels(a: Affrontements): Diagnostic {
  const gagnes = a.duels.filter((d) => d.gagne).length
  return {
    label: 'Affrontements',
    valeur: a.duels.length,
    aide:
      `${a.lignes} lignes d'historique repliees en ${a.duels.length} duels, un par couple grimpeur-bloc. ` +
      `${gagnes} sont gagnes par le grimpeur. Toutes les lignes restent visibles dans l'ecran Donnees.`,
  }
}

// --- Evaluation -------------------------------------------------------------

/**
 * Mesure la qualite predictive : score de Brier (erreur quadratique moyenne
 * sur les probabilites) et taux de bonnes predictions.
 *
 * Attention a la lecture : les scores sont *en echantillon* (on evalue sur
 * l'historique qui a servi a caler les cotes). Ils comparent des formules
 * entre elles, ils ne valident pas une prediction sur du neuf.
 */
export class Evaluateur {
  private somme = 0
  private n = 0
  private bonnes = 0

  ajouter(probaReussite: number, gagne: boolean): void {
    const s = gagne ? 1 : 0
    this.somme += (probaReussite - s) ** 2
    this.n += 1
    if (probaReussite >= 0.5 === gagne) this.bonnes += 1
  }

  get brier(): number {
    return this.n ? this.somme / this.n : 0
  }

  get exactitude(): number {
    return this.n ? this.bonnes / this.n : 0
  }

  diagnostics(): Diagnostic[] {
    return [
      {
        label: 'Score de Brier',
        valeur: this.brier,
        basMieux: true,
        aide:
          "Erreur quadratique moyenne des probabilites predites. 0 = parfait, 0,25 = aussi bon qu'un pile ou face. Mesure en echantillon : elle compare des formules entre elles, elle ne valide pas une prediction sur du neuf.",
      },
      {
        label: 'Predictions correctes',
        valeur: this.exactitude * 100,
        unite: '%',
        aide: "Part des duels ou le camp donne favori l'a effectivement emporte.",
      },
    ]
  }
}

export function etatVide(rating: number, incertitude?: number): EtatRating {
  return { rating, incertitude, matchs: 0, reussites: 0 }
}

/**
 * Cote de depart d'un bloc.
 *
 * - `cotation` : le bloc demarre a la valeur que sa cotation affichee lui
 *   donne sur l'echelle — `ptsParCran x index`, soit 1000 pour un V1, 2000 pour
 *   un V2, et ainsi de suite. Le classement part donc de l'avis de l'ouvreur et
 *   ne fait que le corriger : il converge vite, et l'ecart affiche se lit
 *   directement comme "de combien le calcul deplace l'ouvreur".
 * - `uniforme` : tous les blocs demarrent a la meme valeur, la cotation
 *   affichee n'entre jamais dans le calcul. Le resultat en est alors totalement
 *   independant, ce qui est la seule facon de l'auditer sans biais — au prix
 *   d'une convergence plus lente et de blocs peu repetes moins bien places.
 */
export function amorceBloc(
  indexOfficiel: number,
  ratingInitial: number,
  ptsParCran: number,
  mode: string
): number {
  if (mode !== 'cotation') return ratingInitial
  return indexOfficiel * ptsParCran
}

/**
 * Cote de depart d'un grimpeur.
 *
 * Faire partir tout le monde du milieu de l'echelle est commode mais faux : un
 * debutant passe ses premieres semaines a perdre des points qu'il n'aurait
 * jamais du avoir, et les blocs faciles qu'il affronte encaissent au passage
 * des victoires imméritées. On part donc de son niveau :
 *
 *  - le niveau annonce a l'inscription s'il existe (V4 -> 4000) ;
 *  - sinon, la mediane des blocs qu'il affronte lors de ses premiers duels,
 *    puisqu'on choisit spontanement des blocs proches de son niveau ;
 *  - a defaut, la valeur par defaut.
 */
export function amorcesGrimpeurs(
  dataset: Dataset,
  duels: Duel[],
  ptsParCran: number,
  ratingParDefaut: number,
  mode: string
): Map<string, number> {
  const amorces = new Map<string, number>()
  if (mode !== 'niveau') {
    for (const g of dataset.grimpeurs) amorces.set(g.id, ratingParDefaut)
    return amorces
  }

  const premiersBlocs = new Map<string, number[]>()
  for (const d of duels) {
    const liste = premiersBlocs.get(d.grimpeurId) ?? []
    if (liste.length >= DUELS_POUR_ESTIMER) continue
    const bloc = dataset.blocParId.get(d.blocId)
    if (bloc) liste.push(bloc.indexOfficiel)
    premiersBlocs.set(d.grimpeurId, liste)
  }

  for (const g of dataset.grimpeurs) {
    if (g.niveauDeclare !== null) {
      amorces.set(g.id, g.niveauDeclare * ptsParCran)
      continue
    }
    const vus = premiersBlocs.get(g.id)
    if (vus && vus.length) {
      const tri = [...vus].sort((a, b) => a - b)
      const m = Math.floor(tri.length / 2)
      const mediane = tri.length % 2 ? tri[m] : (tri[m - 1] + tri[m]) / 2
      amorces.set(g.id, mediane * ptsParCran)
      continue
    }
    amorces.set(g.id, ratingParDefaut)
  }
  return amorces
}

/** Nombre de premiers duels servant a estimer un niveau non declare. */
const DUELS_POUR_ESTIMER = 12

// --- Moteur Elo -------------------------------------------------------------

export interface OptionsElo {
  /** Les duels, tries chronologiquement. */
  duels: Duel[]
  /**
   * Ecart de cote au-dela duquel un resultat *attendu* n'est plus compte, en
   * points. 0 = tout compte.
   *
   * Un grimpeur tres au-dessous d'un bloc qui echoue, ou tres au-dessus qui
   * reussit, ne nous apprend rien : le modele le predisait deja. Le probleme
   * est que ces resultats ne sont pas seulement inutiles, ils sont biaises —
   * un bloc que seuls des grimpeurs bien plus faibles affrontent ne recoit que
   * des echecs, donc une poussee vers le haut que rien ne compense, et il
   * derive indefiniment. Les ecarter revient a dire "aucune information" plutot
   * que de laisser la cote glisser.
   */
  ecartNeglige: number
  /** Cote de depart de chaque grimpeur (cf. `amorcesGrimpeurs`). */
  amorcesGrimpeurs: Map<string, number>
  ratingInitial: number
  k: number
  kMin: number
  kDemiVie: number
  echelle: number
  passes: number
  amorce: string
  ptsParCran: number
  /**
   * Score du grimpeur pour ce duel, dans [0, 1]. Le bloc recoit le complement.
   * L'issue est binaire ; ce score permet de la ponderer (flash contre
   * enchainement laborieux).
   */
  score(duel: Duel): number
}

/**
 * Le moteur : on rejoue la chronologie evenement par evenement.
 *
 * Des qu'un grimpeur echoue sur un bloc, il a perdu : ses points passent au
 * bloc, tout de suite. S'il finit par l'envoyer, on lui *rend* exactement les
 * points de cette defaite, puis on joue la victoire — ponderee par le travail
 * qu'elle a demande. Entre les deux, le classement l'a compte comme battu, ce
 * qui est la verite du moment : le bloc lui resistait.
 *
 * Le remboursement est exact — on memorise le deplacement applique et on le
 * retranche — donc rien ne derive. Ce qui change par rapport a un modele qui
 * n'enregistrerait que l'issue finale, ce sont les cotes *intermediaires*, et
 * donc tous les duels joues pendant qu'un projet etait en cours.
 *
 * Plusieurs passes : la premiere sort les cotes de leur valeur initiale ; K
 * decroissant avec le nombre de duels, les suivantes affinent. On mesure le
 * deplacement moyen a chaque passe pour verifier que ca converge.
 */
export function moteurElo(dataset: Dataset, o: OptionsElo): SortieFormule {
  const grimpeurs = new Map<string, EtatRating>()
  const blocs = new Map<string, EtatRating>()
  const evenements = construireEvenements(o.duels)

  // Les cotes de depart ne sont posees qu'une fois : chaque passe reprend la ou
  // la precedente s'est arretee, sans quoi les passes supplementaires ne
  // feraient que rejouer la premiere avec un K plus petit.
  for (const g of dataset.grimpeurs) {
    grimpeurs.set(g.id, etatVide(o.amorcesGrimpeurs.get(g.id) ?? o.ratingInitial))
  }
  for (const b of dataset.blocs) {
    blocs.set(b.id, etatVide(amorceBloc(b.indexOfficiel, o.ratingInitial, o.ptsParCran, o.amorce)))
  }

  const convergence: number[] = []
  const historique: PointHistorique[] = []
  const evaluateur = new Evaluateur()
  const passes = Math.max(1, Math.round(o.passes))
  /** Evenements ecartes a la derniere passe, pour le diagnostic. */
  let negliges = 0

  for (let passe = 1; passe <= passes; passe++) {
    const dernierePasse = passe === passes
    let deplacement = 0
    let nEvenements = 0
    negliges = 0
    if (dernierePasse) historique.length = 0

    /** Deplacements appliques par une defaite, en attente d'un remboursement. */
    const aRembourser = new Map<string, { grimpeur: number; bloc: number }>()
    /** Duels deja comptes dans les effectifs, a la premiere passe. */
    const comptes = new Set<string>()

    for (const ev of evenements) {
      const d = ev.duel
      const eg = grimpeurs.get(d.grimpeurId)
      const eb = blocs.get(d.blocId)
      if (!eg || !eb) continue
      const cle = d.grimpeurId + '|' + d.blocId

      // On rend d'abord les points de la defaite provisoire, exactement.
      if (ev.annuleDefaite) {
        const rendu = aRembourser.get(cle)
        if (rendu) {
          eg.rating -= rendu.grimpeur
          eb.rating -= rendu.bloc
          aRembourser.delete(cle)
        }
      }

      // Le test vient apres le remboursement, donc sur les cotes restaurees.
      // Si une victoire est ecartee ici, la defaite provisoire a tout de meme
      // ete rendue : le duel ne laisse alors aucune trace, ce qui est bien ce
      // qu'on veut dire par "ce duel n'apprend rien".
      if (o.ecartNeglige > 0) {
        const avance = eg.rating - eb.rating
        const attenduSansSurprise =
          (ev.type === 'defaite' && avance <= -o.ecartNeglige) ||
          (ev.type === 'victoire' && avance >= o.ecartNeglige)
        if (attenduSansSurprise) {
          negliges += 1
          continue
        }
      }

      const attendu = esperance(eg.rating, eb.rating, o.echelle)
      const score = ev.type === 'victoire' ? o.score(d) : 0

      // On evalue la prediction au premier evenement du duel, contre son issue
      // finale : c'est la seule prediction qui ait un sens a comparer.
      if (dernierePasse && ev.premier) evaluateur.ajouter(attendu, d.gagne)

      const kg = kEffectif(o.k, o.kMin, o.kDemiVie, eg.matchs)
      const kb = kEffectif(o.k, o.kMin, o.kDemiVie, eb.matchs)
      const delta = score - attendu
      const dg = kg * delta
      const db = -kb * delta

      eg.rating += dg
      eb.rating += db
      if (ev.type === 'defaite') aRembourser.set(cle, { grimpeur: dg, bloc: db })

      // Les effectifs comptent les duels qui ont *servi* : un bloc dont tous
      // les duels sont ecartes affiche zero, n'est pas juge, et reste a son
      // amorce. C'est plus honnete que de le presenter comme bien documente.
      if (passe === 1 && !comptes.has(cle)) {
        comptes.add(cle)
        eg.matchs += 1
        eb.matchs += 1
        if (d.gagne) {
          eg.reussites += 1
          eb.reussites += 1
        }
      }

      deplacement += Math.abs(dg)
      nEvenements += 1

      if (dernierePasse) historique.push({ grimpeurId: d.grimpeurId, t: ev.t, rating: eg.rating })
    }

    convergence.push(nEvenements ? deplacement / nEvenements : 0)
  }

  return {
    grimpeurs,
    blocs,
    historique,
    convergence,
    diagnostics: [
      ...evaluateur.diagnostics(),
      {
        label: 'Duels ecartes',
        valeur: negliges,
        aide:
          "Resultats attendus entre adversaires trop eloignes, ecartes du calcul : ils n'apprennent rien et poussent la cote toujours dans le meme sens. Regle par 'Ecart au-dela duquel un resultat attendu est ignore'.",
      },
      {
        label: 'Deplacement final',
        valeur: convergence[convergence.length - 1] ?? 0,
        unite: 'pts',
        basMieux: true,
        aide:
          "Correction moyenne appliquee par duel a la derniere passe. Elle ne tombe pas a zero — chaque resultat corrige encore un peu — mais elle doit se stabiliser : c'est la courbe de convergence qui doit s'aplatir, pas ce chiffre qui doit s'annuler.",
      },
    ],
  }
}
