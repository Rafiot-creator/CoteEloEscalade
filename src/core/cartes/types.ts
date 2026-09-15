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
  /** Position relative sur le fond de carte, de 0 a 1. */
  x: number
  y: number
  /** Cotation V affichee au centre de la pastille (ex. 'V4'). */
  cotation: string
  /** Style du bloc (dalle, devers, nom du secteur...). Texte libre. */
  style: string
}

export interface Carte {
  /** Image de fond (chemin public), absente = carte abstraite (canevas vierge). */
  fond?: string
  blocs: BlocCarte[]
}

/**
 * Une source fournit la carte d'un centre. Aujourd'hui il n'y en a qu'une,
 * les fichiers versionnes dans data/cartes/ — exactement le meme principe
 * que SourceProvider pour les CSV (src/core/sources/). Le jour d'un serveur,
 * une deuxieme source vient s'ajouter ici, sans que l'interface ne change :
 * VueCarte ne connait que `chargerCarte`, jamais l'origine des donnees.
 */
export interface CarteProvider {
  id: string
  charger(centreId: string): Promise<Carte | null>
}
