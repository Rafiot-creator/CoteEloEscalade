/**
 * Vocabulaire controle du champ `secteur` d'un bloc (colonne "Style" a
 * l'affichage) : le style d'escalade du bloc — pas sa zone physique dans la
 * salle, et pas non plus la "ponderation du style" d'`elo-bloc.ts` (le poids
 * flash contre enchaine), un terme different qui designe autre chose.
 *
 * Une valeur hors de cette liste n'est pas rejetee au chargement (juste
 * signalee en avertissement, cf. `loaders/dataset.ts`) : elle continue de
 * compter dans la cote globale, mais n'apparait dans aucune ventilation par
 * style.
 */
export const STYLES_BLOC = [
  'Dalle/pied',
  'Dalle/force',
  'Dalle/doigts',
  'Coordo',
  'Dyno',
  'Technique/force',
  'Technique/doigt',
  'Dévers/force',
  'Dévers/doigts',
] as const

export type StyleBloc = (typeof STYLES_BLOC)[number]

export function estStyleConnu(valeur: string): valeur is StyleBloc {
  return (STYLES_BLOC as readonly string[]).includes(valeur)
}
