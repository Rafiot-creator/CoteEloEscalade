import Papa from 'papaparse'
import type { SourceProvider } from '.'
import { lireTable } from '../supabase'

/**
 * Les trois tables de la base, remises en CSV avec exactement les colonnes de
 * `data/*.csv` : le pipeline (parseurs, validation, formules) les lit comme
 * avant, sans savoir qu'elles viennent d'une base. L'ecran Fichiers continue
 * aussi de montrer ce qui a ete lu, et ce qui a ete refuse.
 *
 * Un groupe de centres calcules ensemble (un seul centre, ou Rose Bloc 1 et 2 :
 * `GROUPES_CALCUL`, src/App.tsx) : leurs blocs, et les ascensions sur ces blocs (jointure
 * sur `blocs`, la table `ascensions` n'a pas de centre). Les grimpeurs sont
 * communs a tous les centres ; chaque groupe a ses propres cotes, calculees
 * sur ses seules ascensions.
 */
const tables = (centres: string[]) => [
  { nom: 'grimpeurs.csv', table: 'grimpeurs', ordre: 'id', colonnes: ['id', 'nom', 'sexe', 'gym_principal', 'premiere_saison', 'niveau_declare'] },
  {
    nom: 'blocs.csv',
    table: 'blocs',
    ordre: 'id',
    colonnes: ['id', 'nom', 'gym', 'secteur', 'couleur', 'cotation_officielle', 'date_ouverture', 'date_retrait'],
    filtre: { colonne: 'centre_id', valeur: centres },
  },
  {
    nom: 'ascensions.csv',
    table: 'ascensions',
    ordre: 'id',
    colonnes: ['date', 'grimpeur_id', 'bloc_id', 'resultat', 'essais'],
    jointure: 'blocs!inner(centre_id)',
    filtre: { colonne: 'blocs.centre_id', valeur: centres },
  },
]

export const sourceSupabase: SourceProvider = {
  id: 'supabase',
  label: 'Base Supabase',
  labelEn: 'Supabase database',
  async charger(centres = ['demo']) {
    return Promise.all(
      tables(centres).map(async ({ nom, table, ordre, colonnes, filtre, jointure }) => {
        const lignes = await lireTable<Record<string, unknown>>(table, colonnes.join(','), ordre, filtre, jointure)
        const contenu = Papa.unparse({ fields: colonnes, data: lignes.map((l) => colonnes.map((c) => l[c] ?? '')) })
        return { chemin: `supabase/${nom}`, nom, contenu, octets: new Blob([contenu]).size, origine: 'supabase' as const }
      })
    )
  },
}
