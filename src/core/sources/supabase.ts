import Papa from 'papaparse'
import type { SourceProvider } from '.'
import { lireTable } from '../supabase'

/**
 * Les trois tables de la base, remises en CSV avec exactement les colonnes de
 * `data/*.csv` : le pipeline (parseurs, validation, formules) les lit comme
 * avant, sans savoir qu'elles viennent d'une base. L'ecran Fichiers continue
 * aussi de montrer ce qui a ete lu, et ce qui a ete refuse.
 */
const TABLES = [
  { nom: 'grimpeurs.csv', table: 'grimpeurs', ordre: 'id', colonnes: ['id', 'nom', 'sexe', 'gym_principal', 'premiere_saison', 'niveau_declare'] },
  {
    nom: 'blocs.csv',
    table: 'blocs',
    ordre: 'id',
    colonnes: ['id', 'nom', 'gym', 'secteur', 'couleur', 'cotation_officielle', 'date_ouverture', 'date_retrait'],
    // Seul le centre Demo a un jeu de donnees branche sur les ecrans Blocs et
    // Grimpeurs : les blocs qu'un ouvreur place sur la carte d'un autre centre
    // n'y apparaissent pas (ils ne seraient qu'une seconde salle sans duels).
    filtre: { colonne: 'centre_id', valeur: 'demo' },
  },
  { nom: 'ascensions.csv', table: 'ascensions', ordre: 'id', colonnes: ['date', 'grimpeur_id', 'bloc_id', 'resultat', 'essais'] },
]

export const sourceSupabase: SourceProvider = {
  id: 'supabase',
  label: 'Base Supabase',
  labelEn: 'Supabase database',
  async charger() {
    return Promise.all(
      TABLES.map(async ({ nom, table, ordre, colonnes, filtre }) => {
        const lignes = await lireTable<Record<string, unknown>>(table, colonnes.join(','), ordre, filtre)
        const contenu = Papa.unparse({ fields: colonnes, data: lignes.map((l) => colonnes.map((c) => l[c] ?? '')) })
        return { chemin: `supabase/${nom}`, nom, contenu, octets: new Blob([contenu]).size, origine: 'supabase' as const }
      })
    )
  },
}
