import { createClient } from '@supabase/supabase-js'

/**
 * Base Supabase du site (projet `cote-elo-escalade`, region ca-central-1).
 *
 * Ces deux valeurs sont publiques par conception : elles sont lisibles dans
 * le site publie de toute facon. Ce qui protege les donnees, ce sont les
 * droits et les regles d'acces de la base (supabase/migrations/), pas le
 * secret de cette cle. La cle *secrete* du projet ne doit jamais apparaitre
 * dans ce depot.
 */
const URL_SUPABASE = 'https://gmopjbpjiwdbnmxbgsxt.supabase.co'
const CLE_PUBLIQUE = 'sb_publishable_gNCVXtqXFJd3t0BYqz6AQQ_zefrXg1Y'

export const supabase = createClient(URL_SUPABASE, CLE_PUBLIQUE)

/** L'API renvoie au plus 1000 lignes par requete (reglage par defaut de Supabase). */
const PAQUET = 1000

/**
 * Lit une table entiere, par paquets de 1000 lignes demandes en parallele.
 * `ordre` doit etre une colonne unique, sinon deux paquets pourraient se
 * chevaucher ou laisser un trou.
 */
export async function lireTable<T>(table: string, colonnes: string, ordre: string): Promise<T[]> {
  const { count, error } = await supabase.from(table).select(ordre, { count: 'exact', head: true })
  if (error) throw new Error(`Lecture de ${table} impossible : ${error.message}`)
  const paquets = await Promise.all(
    Array.from({ length: Math.ceil((count ?? 0) / PAQUET) }, (_, i) =>
      supabase.from(table).select(colonnes).order(ordre).range(i * PAQUET, (i + 1) * PAQUET - 1)
    )
  )
  return paquets.flatMap(({ data, error: e }) => {
    if (e) throw new Error(`Lecture de ${table} impossible : ${e.message}`)
    return data as T[]
  })
}
