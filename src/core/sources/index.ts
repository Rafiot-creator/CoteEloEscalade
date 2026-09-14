import type { FichierBrut } from '../types'

/**
 * Une *source* fournit des fichiers bruts au pipeline. C'est le seul point du
 * code qui sait d'ou viennent les octets.
 *
 * Aujourd'hui il n'y en a qu'une : les fichiers versionnes dans `data/`.
 * Demain, brancher l'import utilisateur = ajouter un provider ici
 * (lecture d'un `File` deposse + persistance IndexedDB) et le concatener
 * dans `chargerToutesLesSources()`. Rien d'autre ne bouge : ni les parseurs,
 * ni les formules, ni l'interface.
 */
export interface SourceProvider {
  id: string
  label: string
  /** Variante anglaise de `label`. */
  labelEn?: string
  charger(): Promise<FichierBrut[]>
}

/**
 * Les CSV de `data/` sont importes en brut a la compilation : ils font
 * litteralement partie du bundle. Aucun appel reseau au chargement de la page,
 * et le contenu est versionne avec le code.
 */
const modules = import.meta.glob('/data/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const sourceRepo: SourceProvider = {
  id: 'repo',
  label: 'Fichiers du depot',
  labelEn: 'Repository files',
  async charger() {
    return Object.entries(modules)
      .map(([chemin, contenu]) => ({
        chemin: chemin.replace(/^\//, ''),
        nom: chemin.split('/').pop() ?? chemin,
        contenu,
        octets: new Blob([contenu]).size,
        origine: 'repo' as const,
      }))
      .sort((a, b) => a.chemin.localeCompare(b.chemin))
  },
}

export const SOURCES: SourceProvider[] = [sourceRepo]

export async function chargerToutesLesSources(): Promise<FichierBrut[]> {
  const lots = await Promise.all(SOURCES.map((s) => s.charger()))
  return lots.flat()
}
