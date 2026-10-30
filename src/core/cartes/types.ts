import type { Echelle } from '../echelles'

/**
 * Un bloc positionne sur la carte d'un centre.
 *
 * Independant du pipeline Elo (src/core/formulas/, pipeline.ts) : la carte
 * ne sert pas a calculer des cotes, seulement a montrer ou sont les blocs et
 * a quoi ils ressemblent. Un centre peut avoir une carte sans avoir de
 * jeu de donnees d'ascensions, et inversement.
 */
export interface BlocCarte {
  id: string
  /** Nom du bloc tel qu'il figure sur son etiquette (ex. 'DA-0002'). Optionnel : un bloc ajoute a la main sur la carte n'en a pas forcement. */
  nom?: string
  /** Position relative sur le fond de carte, de 0 a 1. */
  x: number
  y: number
  /**
   * Cotation V du bloc (ex. 'V4', ou 'V5.31' pour un centre a echelle maison),
   * affichee sur la pastille dans l'echelle du centre (`Carte.echelle`).
   */
  cotation: string
  /**
   * Couleur des prises, choisie par l'ouvreur : identifiant de
   * `PALETTE_COULEURS` (src/ui/views/VueCarte.tsx), ex. 'bleu', 'noir'.
   */
  couleur: string
  /** Style du bloc (dalle, devers, nom du secteur...). Texte libre. */
  style: string
}

export interface Carte {
  /** Image de fond (chemin public), absente = carte abstraite (canevas vierge). */
  fond?: string
  /**
   * Facteur sur la taille des pastilles (1 par defaut). Pour une salle dont
   * les murs occupent peu de place sur la carte (Rose Bloc 2 : murs en bandes
   * fines, carte carree), ou des pastilles standard ne tiendraient pas toutes.
   */
  taillePastilles?: number
  /**
   * Echelle affichee sur les pastilles et dans l'edition (src/core/echelles.ts),
   * 'v' par defaut. `BlocCarte.cotation` reste toujours une cotation V.
   */
  echelle?: Echelle
  blocs: BlocCarte[]
}

/**
 * Une source fournit la carte d'un centre. Aujourd'hui il n'y en a qu'une,
 * la base Supabase (src/core/cartes/sources.ts) — exactement le meme principe
 * que SourceProvider pour les CSV (src/core/sources/). VueCarte ne connait
 * que `chargerCarte`, jamais l'origine des donnees.
 */
export interface CarteProvider {
  id: string
  charger(centreId: string): Promise<Carte | null>
}
