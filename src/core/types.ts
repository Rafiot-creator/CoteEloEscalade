/**
 * Le vocabulaire du domaine : du bloc en salle. Tout le reste du code parle
 * ces types-la.
 */

export type Sexe = 'F' | 'M' | 'X'
export type Resultat = 'reussite' | 'echec'

export interface Grimpeur {
  id: string
  nom: string
  sexe: Sexe
  /** Salle ou le grimpeur va le plus souvent. Il peut en frequenter d'autres. */
  gymPrincipal: string
  premiereSaison: number
  /**
   * Niveau annonce a l'inscription, en index V. `null` si le grimpeur ne s'est
   * pas prononce — le classement l'estime alors depuis ses premiers blocs.
   */
  niveauDeclare: number | null
}

export interface Bloc {
  id: string
  nom: string
  gym: string
  secteur: string
  /** Couleur des prises. Metadonnee : n'entre dans aucun calcul. */
  couleur: string
  cotationOfficielle: string
  /** Index numerique de la cotation officielle (cf. cotations.ts). */
  indexOfficiel: number
  /** Un bloc en salle a une duree de vie : les ouvertures tournent. */
  dateOuverture: string
  dateRetrait: string | null
}

/**
 * Une ligne d'ascension est un *match* : un grimpeur contre un bloc, gagne ou
 * perdu. Le nombre d'essais est enregistre parce que les salles le notent,
 * mais aucune formule ne s'en sert : une seance sur un bloc vaut un match,
 * qu'elle ait pris trois essais ou trente.
 */
export interface Ascension {
  date: string // ISO aaaa-mm-jj
  /** Millisecondes epoch, precalcule : le tri chronologique est dans la boucle chaude. */
  t: number
  grimpeurId: string
  blocId: string
  resultat: Resultat
  essais: number
}

// --- Chargement -------------------------------------------------------------

export interface FichierBrut {
  /** Chemin tel qu'affiche a l'utilisateur, ex. `data/blocs.csv`. */
  chemin: string
  nom: string
  contenu: string
  octets: number
  origine: 'repo' | 'utilisateur'
}

export interface Anomalie {
  fichier: string
  /** Numero de ligne dans le fichier source, en-tete comprise. */
  ligne: number | null
  champ: string | null
  message: string
  gravite: 'erreur' | 'avertissement'
}

export interface RapportChargement {
  anomalies: Anomalie[]
  lignesLues: Record<string, number>
  lignesRetenues: Record<string, number>
}

export interface Dataset {
  grimpeurs: Grimpeur[]
  blocs: Bloc[]
  /** Trie chronologiquement : les formules comptent dessus. */
  ascensions: Ascension[]
  grimpeurParId: Map<string, Grimpeur>
  blocParId: Map<string, Bloc>
  fichiers: FichierBrut[]
  rapport: RapportChargement
}
