import type { FichierBrut } from '../types'
import { sourceSupabase } from './supabase'

/**
 * Une *source* fournit des fichiers bruts au pipeline. C'est le seul point du
 * code qui sait d'ou viennent les octets.
 *
 * Le site lit la base Supabase (`./supabase.ts`) ; les CSV de `data/`
 * (`./repo.ts`) ne servent plus qu'aux tests et au remplissage de la base.
 * Brancher l'import utilisateur = ajouter un provider ici et le concatener
 * dans `chargerToutesLesSources()`. Rien d'autre ne bouge : ni les parseurs,
 * ni les formules, ni l'interface.
 */
export interface SourceProvider {
  id: string
  label: string
  /** Variante anglaise de `label`. */
  labelEn?: string
  /** `centres` : les centres dont lire les blocs et les ascensions (ignore par les CSV du depot). */
  charger(centres?: string[]): Promise<FichierBrut[]>
}

export const SOURCES: SourceProvider[] = [sourceSupabase]

export async function chargerToutesLesSources(centres: string[]): Promise<FichierBrut[]> {
  const lots = await Promise.all(SOURCES.map((s) => s.charger(centres)))
  return lots.flat()
}
