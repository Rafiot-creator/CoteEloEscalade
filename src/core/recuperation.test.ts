import { describe, expect, it } from 'vitest'
import verite from '../../scripts/verite.json'
import { FORMULES } from './formulas/registry'
import { paramsParDefaut, type Params } from './formulas/types'
import { construireDataset } from './loaders/dataset'
import { executer } from './pipeline'
import { chargerToutesLesSources } from './sources'
import type { Dataset } from './types'

/**
 * Test de recuperation : le jeu de donnees a ete tire d'un niveau latent connu
 * (scripts/verite.json, jamais expose au site). Une formule qui marche doit
 * retrouver ce niveau a partir des seuls duels gagnes et perdus.
 *
 * C'est le seul endroit du projet qui a acces a la reponse. Il sert aussi de
 * banc d'essai pour choisir les valeurs par defaut des parametres.
 */

let cache: Dataset | null = null
async function dataset(): Promise<Dataset> {
  if (!cache) cache = construireDataset(await chargerToutesLesSources())
  return cache
}

function correlation(paires: [number, number][]): number {
  const n = paires.length
  const mx = paires.reduce((s, p) => s + p[0], 0) / n
  const my = paires.reduce((s, p) => s + p[1], 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const [x, y] of paires) {
    sxy += (x - mx) * (y - my)
    sxx += (x - mx) ** 2
    syy += (y - my) ** 2
  }
  return sxy / Math.sqrt(sxx * syy)
}

function mediane(v: number[]): number {
  const t = [...v].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}

/** Index V reel d'un bloc, deduit de sa difficulte latente. */
const indexReel = (rating: number) => (rating - verite.ratingBase) / verite.ptsParCranReel

export async function mesurer(formuleId: string, surcharge: Partial<Params> = {}) {
  const ds = await dataset()
  const f = FORMULES.find((x) => x.id === formuleId)!
  const r = executer(ds, f, { ...paramsParDefaut(f.params), ...surcharge }, {})

  const paires: [number, number][] = []
  const erreurs: number[] = []
  for (const b of r.blocs) {
    const vrai = (verite.blocs as Record<string, number>)[b.id]
    if (vrai === undefined || !b.fiable) continue
    paires.push([b.rating, vrai])
    erreurs.push(Math.abs(b.indexCalcule - indexReel(vrai)))
  }

  const pairesG: [number, number][] = []
  for (const g of r.grimpeurs) {
    const vrai = (verite.grimpeurs as Record<string, number>)[g.id]
    if (vrai === undefined || g.matchs < 20) continue
    pairesG.push([g.rating, vrai])
  }

  return {
    r,
    correlationBlocs: correlation(paires),
    correlationGrimpeurs: correlation(pairesG),
    erreurMedianeCrans: mediane(erreurs),
    r2Cotations: r.calibrage.r2,
    nBlocs: paires.length,
  }
}

describe('recuperation du niveau latent', () => {
  it.each(FORMULES.map((f) => [f.id] as const))(
    '%s retrouve la difficulte reelle des blocs',
    async (id) => {
      const m = await mesurer(id)
      // Avec une mediane de 26 duels par bloc et l'amorce partant de la
      // cotation de l'ouvreur, on attend une erreur nettement sous le demi-cran.
      expect(m.correlationBlocs).toBeGreaterThan(0.97)
      expect(m.correlationGrimpeurs).toBeGreaterThan(0.94)
      expect(m.erreurMedianeCrans).toBeLessThan(0.45)
    },
    60_000
  )

  it(
    'la ponderation du style ameliore l estimation',
    async () => {
      // Le nombre d'essais ne decide pas de l'issue, mais il porte une
      // information sur le rapport de force : un envoi au premier essai et un
      // enchainement au dixieme ne disent pas la meme chose. La ponderation doit
      // donc rapporter quelque chose, sinon elle ne serait qu'un ornement.
      const pondere = await mesurer('elo-bloc')
      const brut = await mesurer('elo-bloc', { scoreEnchaine: 1 })
      expect(pondere.erreurMedianeCrans).toBeLessThan(brut.erreurMedianeCrans)
    },
    60_000
  )

  it(
    "l'amorce depuis la cotation de l'ouvreur est ce qui coute le plus en independance",
    async () => {
      // Partir de la cotation affichee ameliore beaucoup la precision, mais le
      // resultat n'est alors plus independant de l'ouvreur. Ce test documente le
      // compromis plutot qu'il ne le juge.
      const avecPrior = await mesurer('elo-bloc')
      const sansPrior = await mesurer('elo-bloc', { amorce: 'uniforme' })
      expect(avecPrior.erreurMedianeCrans).toBeLessThan(sansPrior.erreurMedianeCrans)
      // Sans a priori, l'estimation reste utilisable, juste moins fine.
      expect(sansPrior.correlationBlocs).toBeGreaterThan(0.9)
    },
    60_000
  )
})
