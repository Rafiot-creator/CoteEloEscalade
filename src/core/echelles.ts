import { COTATIONS, cotationDIndex } from './cotations'

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
 * - 'comp-wall' : echelle d'un *bloc*, pas d'un centre. Le Comp Wall de Rose
 *   Bloc 2 numerote ses 24 blocs de 1 (le plus facile) a 24 (le plus dur),
 *   sans autre cote. Choix de Raphael : 1 = cote 1 du gym, 24 = cote 15, en
 *   progression reguliere, puis la conversion Rose Bloc vers V
 *   (14 -> V7 ; 24 -> V12,39). Un bloc y appartient par sa couleur
 *   (`COULEUR_COMP_WALL`), voir `echelleDuBloc`.
 */
export type Echelle = 'v' | 'rose-bloc' | 'comp-wall'

export const FACTEUR_ROSE_BLOC = 1.13
const COTE_MAX_ROSE_BLOC = 15
const NUMERO_MAX_COMP_WALL = 24
/** Cote du gym par numero du Comp Wall : 14 cotes reparties sur 23 ecarts. */
const PAS_COMP_WALL = (COTE_MAX_ROSE_BLOC - 1) / (NUMERO_MAX_COMP_WALL - 1)

/** Couleur speciale (`PALETTE_COULEURS`, base) qui marque un bloc du Comp Wall. */
export const COULEUR_COMP_WALL = 'comp-wall'

/** Echelle d'un bloc : celle de son centre, sauf pour un bloc du Comp Wall. */
export function echelleDuBloc(couleur: string, echelleCentre: Echelle): Echelle {
  return couleur.toLowerCase() === COULEUR_COMP_WALL ? 'comp-wall' : echelleCentre
}

/** Etiquettes proposees a l'ouvreur, dans l'ordre. */
export function etiquettesEchelle(echelle: Echelle): string[] {
  if (echelle === 'rose-bloc') return Array.from({ length: COTE_MAX_ROSE_BLOC }, (_, i) => String(i + 1))
  if (echelle === 'comp-wall') return Array.from({ length: NUMERO_MAX_COMP_WALL }, (_, i) => String(i + 1))
  return COTATIONS
}

/** Index V continu d'une etiquette d'echelle maison (cote 7 -> 5,31). */
function indexDEtiquette(n: number, echelle: Exclude<Echelle, 'v'>): number {
  const coteGym = echelle === 'comp-wall' ? 1 + (n - 1) * PAS_COMP_WALL : n
  return (coteGym - 1) / FACTEUR_ROSE_BLOC
}

/** Etiquette de l'echelle du centre -> cotation V stockee ('7' -> 'V5.31'). */
export function versCotationV(etiquette: string, echelle: Echelle): string {
  if (echelle === 'v') return etiquette
  const v = indexDEtiquette(Number(etiquette), echelle)
  return `V${Number(v.toFixed(2))}`
}

/** Cotation V stockee -> etiquette de l'echelle du centre ('V5.31' -> '7'). */
export function depuisCotationV(cotation: string, echelle: Echelle): string {
  if (echelle === 'v') return cotation
  const v = Number(cotation.trim().replace(/^v/i, ''))
  if (!Number.isFinite(v)) return cotation
  return etiquetteDIndex(v, echelle)
}

/** Index V continu (une cote calculee, 5,4) -> etiquette de l'echelle du centre ('7'). */
export function etiquetteDIndex(index: number, echelle: Echelle): string {
  if (echelle === 'v') return cotationDIndex(index)
  const coteGym = index * FACTEUR_ROSE_BLOC + 1
  if (echelle === 'comp-wall') {
    return String(Math.min(NUMERO_MAX_COMP_WALL, Math.max(1, Math.round((coteGym - 1) / PAS_COMP_WALL + 1))))
  }
  return String(Math.min(COTE_MAX_ROSE_BLOC, Math.max(1, Math.round(coteGym))))
}

/** Ce qu'affiche la pastille : le numero seul ('V4' -> '4', '7' -> '7'). */
export function numeroPastille(cotation: string, echelle: Echelle): string {
  return depuisCotationV(cotation, echelle).replace(/^V/i, '')
}

/** Ce qu'affiche un bloc special (non cote) a la place de sa cote. */
export const LIBELLE_SPECIAL = 'S'

/**
 * Cote affichee d'un bloc en toutes lettres, dans l'echelle de son centre, ou
 * precedee d'une etoile pour un bloc du Comp Wall ('★12'), ou 'S' pour un bloc
 * special (non cote).
 */
export function libelleCote(cotation: string, couleur: string, echelleCentre: Echelle, special = false): string {
  if (special) return LIBELLE_SPECIAL
  const echelle = echelleDuBloc(couleur, echelleCentre)
  const etiquette = depuisCotationV(cotation, echelle)
  return echelle === 'comp-wall' ? `★${etiquette}` : etiquette
}
