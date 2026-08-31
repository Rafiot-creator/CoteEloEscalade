import { PARAMS_CALIBRAGE, calibrer, ratingVersIndex, type Calibrage, type PointCalibrage } from './calibrage'
import { cotationDIndex } from './cotations'
import { normaliserParams, type Diagnostic, type Formule, type Params, type PointHistorique } from './formulas/types'
import type { Dataset } from './types'

/**
 * Le pipeline : fichiers -> dataset -> formule -> calibrage -> resultat affichable.
 *
 * Les formules ne produisent que des cotes Elo. Tout ce qui est commun — passage
 * en cotations V, taux de reussite, ecarts, resume, connectivite entre salles —
 * est fait ici, une fois pour toutes. Une nouvelle formule herite gratuitement
 * de cette couche.
 */

/**
 * Ecart, en crans V, a partir duquel on considere que le calcul contredit
 * l'ouvreur.
 *
 * Le seuil vient d'une mesure, pas d'une intuition (cf. `desaccords.test.ts`) :
 * a 0,75 cran, tous les blocs signales sont reellement mal cotes, et on en
 * signale deux fois plus qu'a 1 cran. Descendre a 0,5 ferait tomber la
 * precision a 79 %, ce qui abimerait la confiance dans la liste.
 */
export const SEUIL_DESACCORD = 0.75

export interface LigneBloc {
  id: string
  nom: string
  gym: string
  secteur: string
  couleur: string
  dateOuverture: string
  dateRetrait: string | null
  rating: number
  incertitude?: number
  /** Duels *comptes* : ceux dont l'issue n'etait pas jouee d'avance. */
  matchs: number
  reussites: number
  tauxReussite: number
  cotationOfficielle: string
  indexOfficiel: number
  indexCalcule: number
  cotationCalculee: string
  /** Positif = plus dur que sa cotation. Negatif = plus facile. */
  ecart: number
  fiable: boolean
}

export interface LigneGrimpeur {
  id: string
  nom: string
  gymPrincipal: string
  sexe: string
  rating: number
  incertitude?: number
  matchs: number
  reussites: number
  tauxReussite: number
  /** Cotation que le grimpeur a une chance sur deux d'envoyer. */
  indexNiveau: number
  cotationNiveau: string
  /** Cotation affichee la plus dure reellement envoyee. */
  meilleureCotation: string | null
  /** Salles ou le grimpeur a au moins un match compte. */
  gyms: string[]
}

/**
 * Etat d'une salle vis-a-vis du calcul.
 *
 * `ponts` est le chiffre a surveiller : ce sont les grimpeurs qui frequentent
 * aussi une autre salle. Sans eux, rien ne relie l'echelle d'une salle a celle
 * des autres et comparer leurs cotes n'a aucun sens — deux salles sans grimpeur
 * commun peuvent flotter l'une par rapport a l'autre de plusieurs crans sans que
 * les donnees puissent le detecter.
 */
export interface EtatGym {
  gym: string
  blocs: number
  grimpeurs: number
  ponts: number
}

export interface Resume {
  blocsAudites: number
  blocsTotal: number
  desaccords: number
  sousCotes: number
  surCotes: number
  ecartMedianAbs: number
  lignes: number
  /** Couples grimpeur-bloc distincts presents dans les donnees. */
  duels: number
  /** Ceux que le calcul a reellement utilises (cf. l'ecart neglige). */
  duelsComptes: number
  tauxReussiteGlobal: number
  gyms: EtatGym[]
}

export interface Resultat {
  formuleId: string
  formuleLabel: string
  params: Params
  paramsCalibrage: Params
  blocs: LigneBloc[]
  grimpeurs: LigneGrimpeur[]
  historique: PointHistorique[]
  convergence: number[]
  diagnostics: Diagnostic[]
  calibrage: Calibrage
  resume: Resume
  dureeMs: number
}

function mediane(valeurs: number[]): number {
  if (!valeurs.length) return 0
  const t = [...valeurs].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

export function executer(
  dataset: Dataset,
  formule: Formule,
  params: Partial<Params>,
  paramsCalibrage: Partial<Params>
): Resultat {
  const debut = performance.now()
  const p = normaliserParams(formule.params, params)
  const sortie = formule.calculer(dataset, p)

  const pc = normaliserParams(PARAMS_CALIBRAGE, paramsCalibrage)
  const minMatchs = pc.minMatchs as number

  // --- Calibrage sur les blocs suffisamment repetes ---------------------------
  const pointsCalibrage: PointCalibrage[] = []
  for (const b of dataset.blocs) {
    const e = sortie.blocs.get(b.id)
    if (e && e.matchs >= minMatchs) pointsCalibrage.push({ rating: e.rating, indexOfficiel: b.indexOfficiel })
  }
  const calibrage = calibrer(pointsCalibrage, pc)

  // --- Blocs ------------------------------------------------------------------
  const blocs: LigneBloc[] = dataset.blocs.map((b) => {
    const e = sortie.blocs.get(b.id)
    const rating = e?.rating ?? Number.NaN
    const indexCalcule = ratingVersIndex(rating, calibrage)
    return {
      id: b.id,
      nom: b.nom,
      gym: b.gym,
      secteur: b.secteur,
      couleur: b.couleur,
      dateOuverture: b.dateOuverture,
      dateRetrait: b.dateRetrait,
      rating,
      incertitude: e?.incertitude,
      matchs: e?.matchs ?? 0,
      reussites: e?.reussites ?? 0,
      tauxReussite: e && e.matchs ? e.reussites / e.matchs : 0,
      cotationOfficielle: b.cotationOfficielle,
      indexOfficiel: b.indexOfficiel,
      indexCalcule,
      cotationCalculee: cotationDIndex(indexCalcule),
      ecart: indexCalcule - b.indexOfficiel,
      fiable: (e?.matchs ?? 0) >= minMatchs,
    }
  })

  // --- Grimpeurs --------------------------------------------------------------
  const meilleure = new Map<string, number>()
  const gymsParGrimpeur = new Map<string, Set<string>>()
  for (const a of dataset.ascensions) {
    const b = dataset.blocParId.get(a.blocId)
    if (!b) continue
    if (!gymsParGrimpeur.has(a.grimpeurId)) gymsParGrimpeur.set(a.grimpeurId, new Set())
    gymsParGrimpeur.get(a.grimpeurId)!.add(b.gym)
    if (a.resultat !== 'reussite') continue
    const courant = meilleure.get(a.grimpeurId)
    if (courant === undefined || b.indexOfficiel > courant) meilleure.set(a.grimpeurId, b.indexOfficiel)
  }

  const grimpeurs: LigneGrimpeur[] = dataset.grimpeurs.map((g) => {
    const e = sortie.grimpeurs.get(g.id)
    const rating = e?.rating ?? Number.NaN
    const indexNiveau = ratingVersIndex(rating, calibrage)
    const best = meilleure.get(g.id)
    return {
      id: g.id,
      nom: g.nom,
      gymPrincipal: g.gymPrincipal,
      sexe: g.sexe,
      rating,
      incertitude: e?.incertitude,
      matchs: e?.matchs ?? 0,
      reussites: e?.reussites ?? 0,
      tauxReussite: e && e.matchs ? e.reussites / e.matchs : 0,
      indexNiveau,
      cotationNiveau: cotationDIndex(indexNiveau),
      meilleureCotation: best === undefined ? null : cotationDIndex(best),
      gyms: [...(gymsParGrimpeur.get(g.id) ?? [])].sort((x, y) => x.localeCompare(y, 'fr')),
    }
  })

  // --- Connectivite entre salles ----------------------------------------------
  const gyms: EtatGym[] = [...new Set(dataset.blocs.map((b) => b.gym))]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((gym) => ({
      gym,
      blocs: blocs.filter((b) => b.gym === gym).length,
      grimpeurs: grimpeurs.filter((g) => g.gyms.includes(gym)).length,
      ponts: grimpeurs.filter((g) => g.gyms.includes(gym) && g.gyms.length > 1).length,
    }))

  // --- Resume -----------------------------------------------------------------
  const audites = blocs.filter((b) => b.fiable)
  const reussitesTotal = dataset.ascensions.filter((a) => a.resultat === 'reussite').length
  const duels = new Set(dataset.ascensions.map((a) => a.grimpeurId + '|' + a.blocId)).size
  const duelsComptes = blocs.reduce((s, b) => s + b.matchs, 0)
  const resume: Resume = {
    blocsAudites: audites.length,
    blocsTotal: blocs.length,
    desaccords: audites.filter((b) => Math.abs(b.ecart) >= SEUIL_DESACCORD).length,
    sousCotes: audites.filter((b) => b.ecart >= SEUIL_DESACCORD).length,
    surCotes: audites.filter((b) => b.ecart <= -SEUIL_DESACCORD).length,
    ecartMedianAbs: mediane(audites.map((b) => Math.abs(b.ecart))),
    lignes: dataset.ascensions.length,
    duels,
    duelsComptes,
    tauxReussiteGlobal: dataset.ascensions.length ? reussitesTotal / dataset.ascensions.length : 0,
    gyms,
  }

  return {
    formuleId: formule.id,
    formuleLabel: formule.label,
    params: p,
    paramsCalibrage: pc,
    blocs,
    grimpeurs,
    historique: sortie.historique,
    convergence: sortie.convergence,
    diagnostics: sortie.diagnostics,
    calibrage,
    resume,
    dureeMs: performance.now() - debut,
  }
}

// --- Memoisation ------------------------------------------------------------
// Bouger un curseur relance tout le calcul ; revenir en arriere doit etre
// instantane. Cache minuscule, volontairement : les resultats sont gros.

const CACHE_MAX = 12
const cache = new Map<string, Resultat>()
let datasetCourant: Dataset | null = null

export function executerMemo(
  dataset: Dataset,
  formule: Formule,
  params: Partial<Params>,
  paramsCalibrage: Partial<Params>
): Resultat {
  if (datasetCourant !== dataset) {
    cache.clear()
    datasetCourant = dataset
  }
  const cle = JSON.stringify([formule.id, params, paramsCalibrage])
  const connu = cache.get(cle)
  if (connu) return connu

  const resultat = executer(dataset, formule, params, paramsCalibrage)
  cache.set(cle, resultat)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
  return resultat
}
