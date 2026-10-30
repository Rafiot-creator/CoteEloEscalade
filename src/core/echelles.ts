import { COTATIONS } from './cotations'

/**
 * Echelle *affichee* par un centre sur sa carte et dans l'edition des blocs.
 *
 * Le calcul ne connait que l'echelle V (src/core/cotations.ts) : la base garde
 * toujours une cotation V (`blocs.cotation_officielle`), eventuellement
 * fractionnaire ('V5.31'). Une echelle maison n'est qu'une traduction a
 * l'affichage et a la saisie, choisie par centre (`centres.echelle`).
 *
 * - 'v' : cotation V telle quelle (Demo, Bloc Shop...).
 * - 'rose-bloc' : cotes 1 a 15 des salles Rose Bloc. Conversion donnee par
 *   Raphael : 1 = V0, puis un facteur choisi pour que 10 tombe au plus pres de
 *   V8 avec deux decimales au plus, soit V = (cote - 1) / 1,13
 *   (10 -> V7,96 ; 15 -> V12,39).
 */
export type Echelle = 'v' | 'rose-bloc'

export const FACTEUR_ROSE_BLOC = 1.13
const COTE_MAX_ROSE_BLOC = 15

/** Etiquettes proposees a l'ouvreur, dans l'ordre. */
export function etiquettesEchelle(echelle: Echelle): string[] {
  if (echelle === 'rose-bloc') return Array.from({ length: COTE_MAX_ROSE_BLOC }, (_, i) => String(i + 1))
  return COTATIONS
}

/** Etiquette de l'echelle du centre -> cotation V stockee ('7' -> 'V5.31'). */
export function versCotationV(etiquette: string, echelle: Echelle): string {
  if (echelle === 'v') return etiquette
  const v = (Number(etiquette) - 1) / FACTEUR_ROSE_BLOC
  return `V${Number(v.toFixed(2))}`
}

/** Cotation V stockee -> etiquette de l'echelle du centre ('V5.31' -> '7'). */
export function depuisCotationV(cotation: string, echelle: Echelle): string {
  if (echelle === 'v') return cotation
  const v = Number(cotation.trim().replace(/^v/i, ''))
  if (!Number.isFinite(v)) return cotation
  return String(Math.min(COTE_MAX_ROSE_BLOC, Math.max(1, Math.round(v * FACTEUR_ROSE_BLOC + 1))))
}

/** Ce qu'affiche la pastille : le numero seul ('V4' -> '4', '7' -> '7'). */
export function numeroPastille(cotation: string, echelle: Echelle): string {
  return depuisCotationV(cotation, echelle).replace(/^V/i, '')
}
