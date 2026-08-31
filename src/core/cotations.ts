/**
 * Echelle V (Hueco), utilisee pour le bloc.
 *
 * Toute la chaine de calcul travaille sur un *index numerique continu*, et ici
 * l'index est simplement le numero : V5 -> 5. Un index fractionnaire (5,4) est
 * legitime, c'est la sortie naturelle d'une regression ; on n'arrondit qu'a
 * l'affichage.
 *
 * Changer d'echelle (echelle francaise, Fontainebleau, une echelle maison) se
 * fait en remplacant `COTATIONS` : rien d'autre dans le projet ne connait les
 * etiquettes.
 */

export const V_MAX = 12

export const COTATIONS = Array.from({ length: V_MAX + 1 }, (_, i) => `V${i}`)

export type Cotation = string

const INDEX_PAR_COTATION = new Map<string, number>(COTATIONS.map((c, i) => [c.toLowerCase(), i]))

export function estCotation(valeur: string): boolean {
  return indexDeCotation(valeur) !== null
}

/**
 * 'V5' -> 5. Tolere la casse, les espaces, et le numero nu ('5') que produisent
 * beaucoup d'exports de salle.
 */
export function indexDeCotation(cotation: string): number | null {
  const brut = cotation.trim().toLowerCase()
  const direct = INDEX_PAR_COTATION.get(brut)
  if (direct !== undefined) return direct
  if (/^\d{1,2}$/.test(brut)) {
    const n = Number(brut)
    return n >= 0 && n <= V_MAX ? n : null
  }
  return null
}

/** 5 -> 'V5'. Un index fractionnaire est arrondi au cran le plus proche. */
export function cotationDIndex(index: number): Cotation {
  const i = Math.round(index)
  if (i < 0) return COTATIONS[0]
  if (i >= COTATIONS.length) return COTATIONS[COTATIONS.length - 1]
  return COTATIONS[i]
}

/**
 * Affichage d'un index fractionnaire : 'V5 (+0,4)' pour 5,4.
 * On garde la fraction visible plutot que de la masquer par un arrondi : c'est
 * elle qui dit si un bloc est "un V5 gentil" ou "un V5 costaud".
 */
export function formaterIndex(index: number): string {
  if (!Number.isFinite(index)) return '—'
  const base = Math.round(index)
  const reste = index - base
  const cot = cotationDIndex(base)
  if (Math.abs(reste) < 0.05) return cot
  return `${cot} (${reste > 0 ? '+' : '−'}${Math.abs(reste).toFixed(1).replace('.', ',')})`
}

/** Nombre de crans entre deux cotations, signe. */
export function ecartEnCrans(cotationA: string, cotationB: string): number | null {
  const a = indexDeCotation(cotationA)
  const b = indexDeCotation(cotationB)
  if (a === null || b === null) return null
  return a - b
}
