import type { Carte, CarteProvider } from './types'

/**
 * Comme les CSV de data/ (cf. src/core/sources/), les cartes sont importees
 * en brut a la compilation : un fichier data/cartes/<centre>.json par centre.
 */
const modules = import.meta.glob('/data/cartes/*.json', { eager: true }) as Record<
  string,
  { default: Carte }
>

const cartesParCentre = new Map<string, Carte>()
for (const [chemin, mod] of Object.entries(modules)) {
  const id = chemin.split('/').pop()?.replace(/\.json$/, '') ?? chemin
  cartesParCentre.set(id, mod.default)
}

export const carteRepo: CarteProvider = {
  id: 'repo',
  async charger(centreId) {
    return cartesParCentre.get(centreId) ?? null
  },
}

/**
 * Un centre sans carte connue retombe sur une carte vide et abstraite :
 * pas une erreur, un point de depart pour qui veut la remplir.
 */
export const CARTE_PROVIDERS: CarteProvider[] = [carteRepo]

export async function chargerCarte(centreId: string): Promise<Carte> {
  for (const source of CARTE_PROVIDERS) {
    const carte = await source.charger(centreId)
    if (carte) return carte
  }
  return { blocs: [] }
}
