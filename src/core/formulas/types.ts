import type { Dataset } from '../types'

/**
 * Le contrat des formules.
 *
 * Une formule est un module autodescriptif : elle declare ses parametres,
 * l'interface les rend toute seule (curseurs, cases a cocher, listes) et
 * les lui repasse. Ajouter une formule = deposer un fichier dans
 * `definitions/`, rien d'autre. Voir `registry.ts`.
 */

export interface ParamBase {
  nom: string
  label: string
  aide?: string
  /** Titre de section dans le panneau de reglages. */
  groupe?: string
}

export interface ParamNombre extends ParamBase {
  type: 'nombre'
  defaut: number
  min: number
  max: number
  pas: number
  unite?: string
}

export interface ParamBooleen extends ParamBase {
  type: 'booleen'
  defaut: boolean
}

export interface ParamChoix extends ParamBase {
  type: 'choix'
  defaut: string
  options: { valeur: string; label: string }[]
}

export type ParamSpec = ParamNombre | ParamBooleen | ParamChoix

export type Params = Record<string, number | boolean | string>

/** Etat estime d'une entite (grimpeur ou bloc) a la fin du calcul. */
export interface EtatRating {
  rating: number
  /** Ecart-type du rating, si la formule en produit un (Glicko). */
  incertitude?: number
  matchs: number
  reussites: number
}

export interface PointHistorique {
  grimpeurId: string
  t: number
  rating: number
}

export interface Diagnostic {
  label: string
  valeur: number
  unite?: string
  /** `true` = un chiffre plus bas est meilleur (erreur, ecart...). */
  basMieux?: boolean
  aide?: string
}

export interface SortieFormule {
  grimpeurs: Map<string, EtatRating>
  blocs: Map<string, EtatRating>
  /** Trajectoire des grimpeurs sur la derniere passe (pour la courbe de progression). */
  historique: PointHistorique[]
  /** Deplacement moyen des cotes a chaque passe : doit se stabiliser. */
  convergence: number[]
  diagnostics: Diagnostic[]
}

export interface Formule<P extends Params = Params> {
  id: string
  label: string
  /** Nom tenant dans un en-tete de colonne. A defaut, `label` est utilise. */
  labelCourt?: string
  /** Une phrase : ce que la formule suppose, et pour qui elle est faite. */
  description: string
  params: ParamSpec[]
  calculer(dataset: Dataset, params: P): SortieFormule
}

/** Les valeurs par defaut declarees par une liste de parametres. */
export function paramsParDefaut(specs: ParamSpec[]): Params {
  const out: Params = {}
  for (const s of specs) out[s.nom] = s.defaut
  return out
}

/** Complete les valeurs manquantes et ignore les cles inconnues. */
export function normaliserParams(specs: ParamSpec[], valeurs: Partial<Params>): Params {
  const out: Params = {}
  for (const s of specs) {
    const v = valeurs[s.nom]
    out[s.nom] = v === undefined || typeof v !== typeof s.defaut ? s.defaut : v
  }
  return out
}
