import type { SourceProvider } from '.'

/**
 * Les CSV de `data/` sont importes en brut a la compilation. Le site ne s'en
 * sert plus depuis le passage a Supabase (cf. `./supabase.ts`) : ils restent
 * la source du jeu de demonstration, que les tests lisent ici et que
 * `scripts/generer-seed-supabase.mjs` verse dans la base.
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
