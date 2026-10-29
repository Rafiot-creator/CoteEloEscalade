import type { BlocCarte, Carte, CarteProvider } from './types'
import { supabase } from '../supabase'

interface LigneCentre {
  fond: string | null
  taille_pastilles: number
}
interface LigneBloc {
  id: string
  nom: string
  x: number
  y: number
  cotation_officielle: string
  couleur: string
  secteur: string
}

/**
 * La carte d'un centre vient de la base : son fond et sa taille de pastilles
 * (table `centres`), et les blocs qui y ont une position (table `blocs`, x/y
 * non nuls). `data/cartes/*.json` ne sert plus qu'a remplir la base
 * (`scripts/generer-seed-supabase.mjs`).
 */
export const carteSupabase: CarteProvider = {
  id: 'supabase',
  async charger(centreId) {
    const [centre, blocs] = await Promise.all([
      supabase.from('centres').select('fond, taille_pastilles').eq('id', centreId).maybeSingle<LigneCentre>(),
      supabase
        .from('blocs')
        .select('id, nom, x, y, cotation_officielle, couleur, secteur')
        .eq('centre_id', centreId)
        .not('x', 'is', null)
        .order('id')
        .returns<LigneBloc[]>(),
    ])
    if (centre.error) throw new Error(`Lecture de la carte impossible : ${centre.error.message}`)
    if (blocs.error) throw new Error(`Lecture des blocs de la carte impossible : ${blocs.error.message}`)
    if (!centre.data) return null
    return {
      ...(centre.data.fond ? { fond: centre.data.fond } : {}),
      ...(centre.data.taille_pastilles !== 1 ? { taillePastilles: centre.data.taille_pastilles } : {}),
      blocs: (blocs.data ?? []).map((b) => ({
        id: b.id,
        nom: b.nom,
        x: b.x,
        y: b.y,
        cotation: b.cotation_officielle,
        // La base garde la couleur telle que dans blocs.csv ('Rouge') ; la
        // carte attend l'identifiant de PALETTE_COULEURS ('rouge').
        couleur: b.couleur.toLowerCase(),
        style: b.secteur,
      })),
    }
  },
}

/**
 * Outils de l'ouvreur : chaque ecriture passe par une fonction de la base
 * (`placer_bloc`, `modifier_bloc`, `demonter_bloc`,
 * supabase/migrations/20261029000300_ouvreurs.sql), qui verifie elle-meme que
 * le compte est ouvreur du centre. Renvoient le message d'erreur de la base,
 * ou null.
 */
function champsBloc(b: Omit<BlocCarte, 'id'>) {
  return { x: b.x, y: b.y, cotation: b.cotation, couleur: b.couleur, secteur: b.style, nom: b.nom ?? '' }
}

export async function placerBloc(centreId: string, b: Omit<BlocCarte, 'id'>): Promise<{ id: string } | { erreur: string }> {
  const { data, error } = await supabase.rpc('placer_bloc', { centre: centreId, ...champsBloc(b) })
  return error ? { erreur: error.message } : { id: data as string }
}

export async function modifierBloc(b: BlocCarte): Promise<string | null> {
  const { error } = await supabase.rpc('modifier_bloc', { bloc: b.id, ...champsBloc(b) })
  return error ? error.message : null
}

/** Retire le bloc de la carte ; la base garde son historique s'il a ete grimpe. */
export async function demonterBloc(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('demonter_bloc', { bloc: id })
  return error ? error.message : null
}

/**
 * Un centre sans carte connue retombe sur une carte vide et abstraite :
 * pas une erreur, un point de depart pour qui veut la remplir.
 */
export const CARTE_PROVIDERS: CarteProvider[] = [carteSupabase]

export async function chargerCarte(centreId: string): Promise<Carte> {
  for (const source of CARTE_PROVIDERS) {
    const carte = await source.charger(centreId)
    if (carte) return carte
  }
  return { blocs: [] }
}
