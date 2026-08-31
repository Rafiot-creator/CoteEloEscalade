import { COTATIONS } from './cotations'
import type { ParamSpec, Params } from './formulas/types'

/**
 * Le calibrage traduit une cote Elo (une unite arbitraire, interne au modele)
 * en cotation V (l'unite dans laquelle les grimpeurs parlent).
 *
 * C'est deliberement une etape *separee* des formules : toutes les formules
 * produisent des cotes, une seule regle les convertit. On peut donc changer
 * de formule sans changer d'echelle, et inversement.
 */

export const PARAMS_CALIBRAGE: ParamSpec[] = [
  {
    nom: 'mode',
    label: 'Methode',
    type: 'choix',
    defaut: 'ancre',
    options: [
      { valeur: 'ancre', label: 'Echelle fixe (1000 points par cran V)' },
      { valeur: 'auto', label: 'Regression sur les cotations affichees' },
    ],
    aide:
      "Echelle fixe : la conversion est celle de la convention maison, cote / 1000 = cran V. Regression : on cherche a la place l'echelle qui colle le mieux aux cotations affichees. Comparer les deux est instructif — si la regression trouve nettement moins de 1000 points par cran, c'est que les crans de la salle sont plus resserres que la convention ne le suppose.",
  },
  {
    nom: 'minMatchs',
    label: 'Duels minimum',
    type: 'nombre',
    defaut: 8,
    min: 1,
    max: 50,
    pas: 1,
    aide: "Un bloc affronte par deux personnes ne calibre rien. En dessous de ce seuil, le bloc est calcule mais exclu de la regression et marque peu fiable. Les blocs fraichement ouverts sont souvent dans ce cas.",
  },
  {
    nom: 'cotationAncre',
    label: 'Cotation de reference',
    type: 'choix',
    defaut: 'V1',
    options: COTATIONS.map((c) => ({ valeur: c, label: c })),
    aide: "Avec la cote de reference, fixe le point d'ancrage : par defaut V1 vaut 1000. Sans effet en mode regression.",
  },
  {
    nom: 'ratingAncre',
    label: 'Cote de reference',
    type: 'nombre',
    defaut: 1000,
    min: 0,
    max: 12000,
    pas: 100,
    unite: 'pts',
    aide: 'La cote Elo qui vaut exactement la cotation de reference. Sans effet en mode regression.',
  },
  {
    nom: 'ptsParCran',
    label: 'Points par cran V',
    type: 'nombre',
    defaut: 1000,
    min: 100,
    max: 3000,
    pas: 50,
    unite: 'pts',
    aide: "Ecart de cote entre deux crans V consecutifs. Sans effet en mode regression.",
  },
]

export interface Calibrage {
  /** index_cotation = pente x rating + ordonnee */
  pente: number
  ordonnee: number
  /** Qualite de l'ajustement sur les blocs retenus (mode auto). */
  r2: number
  nBlocs: number
  mode: 'auto' | 'ancre'
  /** Renseigne quand la regression a echoue et qu'on est retombe sur l'ancrage. */
  avertissement?: string
}

export interface PointCalibrage {
  rating: number
  indexOfficiel: number
}

function ancrage(params: Params, motif?: string): Calibrage {
  const pts = Math.max(1, params.ptsParCran as number)
  const idx = COTATIONS.indexOf(params.cotationAncre as string)
  const indexAncre = idx >= 0 ? idx : 4
  const pente = 1 / pts
  return {
    pente,
    ordonnee: indexAncre - pente * (params.ratingAncre as number),
    r2: 0,
    nBlocs: 0,
    mode: 'ancre',
    avertissement: motif,
  }
}

/** Moindres carres ordinaires de l'index de cotation sur la cote. */
export function calibrer(points: PointCalibrage[], params: Params): Calibrage {
  if (params.mode !== 'auto') return ancrage(params)
  if (points.length < 3) {
    return ancrage(params, 'Trop peu de blocs exploitables pour une regression : ancrage manuel applique.')
  }

  const n = points.length
  const moyX = points.reduce((s, p) => s + p.rating, 0) / n
  const moyY = points.reduce((s, p) => s + p.indexOfficiel, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const p of points) {
    const dx = p.rating - moyX
    const dy = p.indexOfficiel - moyY
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || sxy <= 0) {
    return ancrage(
      params,
      "Les cotes ne sont pas correlees positivement aux cotations : ancrage manuel applique. Verifier le nombre de passes et le volume de donnees."
    )
  }

  const pente = sxy / sxx
  return {
    pente,
    ordonnee: moyY - pente * moyX,
    r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy),
    nBlocs: n,
    mode: 'auto',
  }
}

export function ratingVersIndex(rating: number, c: Calibrage): number {
  return c.pente * rating + c.ordonnee
}

/** Combien de points de cote vaut un cran V, pour ce calibrage. */
export function pointsParCran(c: Calibrage): number {
  return c.pente === 0 ? Number.POSITIVE_INFINITY : 1 / c.pente
}
