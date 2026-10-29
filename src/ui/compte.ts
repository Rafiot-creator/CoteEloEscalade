import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../core/supabase'

/**
 * Le compte connecte, s'il y en a un.
 *
 * Connexion par lien envoye par courriel (Supabase Auth, sans mot de passe).
 * La session est gardee par le navigateur (localStorage, gere par la
 * bibliotheque Supabase) : un nouveau courriel n'est necessaire que sur un
 * nouvel appareil, apres une deconnexion ou un effacement des donnees du
 * navigateur.
 *
 * A la premiere connexion, le compte choisit un pseudonyme : c'est le nom de
 * son grimpeur dans la base, seul visible publiquement (jamais le courriel).
 * Tout passe par les fonctions de la base (`creer_profil`,
 * `enregistrer_envoi`, cf. supabase/migrations/), qui verifient elles-memes
 * qui appelle.
 */
export interface Compte {
  /**
   * La session initiale et le profil ont ete lus (evite d'afficher "Se
   * connecter" ou le choix du pseudonyme une fraction de seconde).
   */
  pret: boolean
  courriel: string | null
  /** Grimpeur du compte, une fois le pseudonyme choisi. */
  grimpeur: { id: string; nom: string } | null
  envoyerLien: (courriel: string) => Promise<string | null>
  creerProfil: (pseudo: string) => Promise<string | null>
  deconnecter: () => Promise<void>
}

/** Ou revient le lien du courriel : la page en cours, sans parametres. */
function adresseRetour(): string {
  return window.location.origin + window.location.pathname
}

export function useCompte(): Compte {
  const [sessionLue, setSessionLue] = useState(false)
  // Compte pour lequel le profil a ete lu (undefined : pas encore lu). Un
  // simple booleen laisserait passer un rendu ou la session vient d'arriver
  // mais ou le profil lu est encore celui d'avant (aucun compte).
  const [profilLuPour, setProfilLuPour] = useState<string | null | undefined>(undefined)
  const [userId, setUserId] = useState<string | null>(null)
  const [courriel, setCourriel] = useState<string | null>(null)
  const [grimpeur, setGrimpeur] = useState<{ id: string; nom: string } | null>(null)

  useEffect(() => {
    // Lit aussi le retour du lien du courriel (jetons dans l'adresse), que la
    // bibliotheque transforme elle-meme en session.
    const { data } = supabase.auth.onAuthStateChange((_evenement, session) => {
      setUserId(session?.user.id ?? null)
      setCourriel(session?.user.email ?? null)
      setSessionLue(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const lireProfil = useCallback(async () => {
    if (!userId) {
      setGrimpeur(null)
      setProfilLuPour(null)
      return
    }
    const { data } = await supabase
      .from('profils')
      .select('grimpeur_id, grimpeurs(nom)')
      .eq('user_id', userId)
      .maybeSingle<{ grimpeur_id: string; grimpeurs: { nom: string } | null }>()
    setGrimpeur(data ? { id: data.grimpeur_id, nom: data.grimpeurs?.nom ?? '' } : null)
    setProfilLuPour(userId)
  }, [userId])

  useEffect(() => {
    void lireProfil()
  }, [lireProfil])

  const envoyerLien = useCallback(async (adresse: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: adresse.trim(),
      options: { emailRedirectTo: adresseRetour() },
    })
    return error ? error.message : null
  }, [])

  const creerProfil = useCallback(
    async (pseudo: string) => {
      const { error } = await supabase.rpc('creer_profil', { pseudo })
      if (error) return error.message
      await lireProfil()
      return null
    },
    [lireProfil]
  )

  const deconnecter = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { pret: sessionLue && profilLuPour === userId, courriel, grimpeur, envoyerLien, creerProfil, deconnecter }
}
