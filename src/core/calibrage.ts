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
    label: 'Méthode',
    labelEn: 'Method',
    type: 'choix',
    defaut: 'ancre',
    options: [
      { valeur: 'ancre', label: 'Échelle fixe (1000 points par cote V)', labelEn: 'Fixed scale (1000 points per V grade)' },
      { valeur: 'auto', label: 'Régression sur les cotations affichées', labelEn: 'Regression on displayed grades' },
    ],
    aide:
      "Échelle fixe : la conversion est celle de la convention maison, cote / 1000 = cote V. Régression : on cherche à la place l'échelle qui colle le mieux aux cotations affichées. Comparer les deux est instructif — si la régression trouve nettement moins de 1000 points par cote, c'est que les cotes de la salle sont plus resserrées que la convention ne le suppose.",
    aideEn:
      "Fixed scale: the conversion follows the house convention, rating / 1000 = V grade. Regression: instead, finds the scale that best fits the displayed grades. Comparing the two is instructive — if regression finds noticeably fewer than 1000 points per grade, this gym's grades are more tightly packed than the convention assumes.",
  },
  {
    nom: 'minMatchs',
    label: 'Duels minimum',
    labelEn: 'Minimum duels',
    type: 'nombre',
    defaut: 8,
    min: 1,
    max: 50,
    pas: 1,
    aide: "Un bloc affronté par deux personnes ne calibre rien. En dessous de ce seuil, le bloc est calculé mais exclu de la régression et marqué peu fiable. Les blocs fraîchement ouverts sont souvent dans ce cas.",
    aideEn: "A boulder faced by two people calibrates nothing. Below this threshold, the boulder is still calculated but excluded from the regression and marked unreliable. Freshly set boulders are often in this case.",
  },
  {
    nom: 'cotationAncre',
    label: 'Cotation de référence',
    labelEn: 'Reference grade',
    type: 'choix',
    defaut: 'V1',
    options: COTATIONS.map((c) => ({ valeur: c, label: c })),
    aide: "Avec la cote de référence, fixe le point d'ancrage : par défaut V1 vaut 1000. Sans effet en mode régression.",
    aideEn: "Together with the reference rating, sets the anchor point: by default V1 equals 1000. No effect in regression mode.",
  },
  {
    nom: 'ratingAncre',
    label: 'Cote de référence',
    labelEn: 'Reference rating',
    type: 'nombre',
    defaut: 1000,
    min: 0,
    max: 12000,
    pas: 100,
    unite: 'pts',
    aide: 'La cote Elo qui vaut exactement la cotation de référence. Sans effet en mode régression.',
    aideEn: 'The Elo rating that is worth exactly the reference grade. No effect in regression mode.',
  },
  {
    nom: 'ptsParCran',
    label: 'Points par cote V',
    labelEn: 'Points per V grade',
    type: 'nombre',
    defaut: 1000,
    min: 100,
    max: 3000,
    pas: 50,
    unite: 'pts',
    aide: "Écart de cote entre deux cotes V consécutives. Sans effet en mode régression.",
    aideEn: 'Rating gap between two consecutive V grades. No effect in regression mode.',
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
  /** Variante anglaise de `avertissement`. */
  avertissementEn?: string
}

export interface PointCalibrage {
  rating: number
  indexOfficiel: number
}

function ancrage(params: Params, motif?: string, motifEn?: string): Calibrage {
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
    avertissementEn: motifEn,
  }
}

/** Moindres carres ordinaires de l'index de cotation sur la cote. */
export function calibrer(points: PointCalibrage[], params: Params): Calibrage {
  if (params.mode !== 'auto') return ancrage(params)
  if (points.length < 3) {
    return ancrage(
      params,
      'Trop peu de blocs exploitables pour une régression : ancrage manuel appliqué.',
      'Too few ratable boulders for a regression: manual anchoring applied.'
    )
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
      "Les cotes ne sont pas corrélées positivement aux cotations : ancrage manuel appliqué. Vérifier le nombre de passes et le volume de données.",
      'Ratings are not positively correlated with grades: manual anchoring applied. Check the number of passes and the volume of data.'
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
