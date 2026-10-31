import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../core/supabase'
import { useLangue } from './langue'

/**
 * Le compte connecte, s'il y en a un.
 *
 * Connexion par Google, ou par courriel et mot de passe (Supabase Auth). Le
 * courriel ne sert alors qu'a confirmer l'adresse a l'inscription et a
 * reinitialiser un mot de passe oublie. Une adresse deja connue par l'un des
 * deux moyens retrouve le meme compte par l'autre (Supabase relie les
 * identites qui partagent une adresse verifiee). La session est gardee par le
 * navigateur (localStorage, geree par la bibliotheque Supabase).
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
  /** `niveauDeclare` : cote de depart declaree (flash + 1, cf. supabase/migrations/), null si aucune. */
  grimpeur: { id: string; nom: string; niveauDeclare: string | null } | null
  /**
   * Le compte peut-il placer, modifier et demonter les blocs de ce centre ?
   * Table `ouvreurs` (cf. supabase/migrations/) ; la base le reverifie de
   * toute facon a chaque ecriture.
   */
  peutOuvrir: (centreId: string) => boolean
  /** Admin general (ligne de `ouvreurs` sans centre) : ecran Administration. La base le reverifie aussi. */
  estAdmin: boolean
  /**
   * Retour du lien « mot de passe oublie » : la session est ouverte, il reste
   * a choisir un nouveau mot de passe.
   */
  recuperation: boolean
  // Chacune renvoie un message d'erreur, ou null.
  /** Secours si le bouton de Google ne charge pas : passe par une redirection. */
  connecterGoogle: () => Promise<string | null>
  /** Jeton remis par le bouton de Google (cf. BoutonGoogle), et le nonce brut dont il porte l'empreinte. */
  connecterJetonGoogle: (jeton: string, nonce: string) => Promise<string | null>
  connecter: (courriel: string, motDePasse: string) => Promise<string | null>
  /** `confirmer` : un courriel de confirmation a ete envoye, pas encore de session. */
  inscrire: (courriel: string, motDePasse: string) => Promise<{ erreur: string | null; confirmer: boolean }>
  oublie: (courriel: string) => Promise<string | null>
  changerMotDePasse: (motDePasse: string) => Promise<string | null>
  /** `flash` : cote flashee habituellement (ex. 'V4'), ou null si le grimpeur ne sait pas. */
  creerProfil: (pseudo: string, flash: string | null) => Promise<string | null>
  /** Pour un compte sans niveau declare (cree avant la question), une seule fois. */
  declarerFlash: (flash: string) => Promise<string | null>
  deconnecter: () => Promise<void>
}

/** Ou reviennent Google et les liens des courriels : la page en cours, sans parametres. */
function adresseRetour(): string {
  return window.location.origin + window.location.pathname
}

/** Messages de Supabase Auth les plus courants, traduits pour le site en francais (ils sont deja en anglais). */
const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Courriel ou mot de passe incorrect.',
  'Email not confirmed': "Adresse pas encore confirmée : ouvrez le lien reçu par courriel à l'inscription.",
  'User already registered': 'Un compte existe déjà avec ce courriel : connectez-vous.',
  'Password should be at least 6 characters.': 'Le mot de passe doit faire au moins 6 caractères.',
  'New password should be different from the old password.': "Le nouveau mot de passe doit être différent de l'ancien.",
}
function traduire(e: { message: string }, langue: string): string {
  return langue === 'fr' ? (MESSAGES[e.message] ?? e.message) : e.message
}

export function useCompte(): Compte {
  const [sessionLue, setSessionLue] = useState(false)
  // Compte pour lequel le profil a ete lu (undefined : pas encore lu). Un
  // simple booleen laisserait passer un rendu ou la session vient d'arriver
  // mais ou le profil lu est encore celui d'avant (aucun compte).
  const [profilLuPour, setProfilLuPour] = useState<string | null | undefined>(undefined)
  const [userId, setUserId] = useState<string | null>(null)
  const [courriel, setCourriel] = useState<string | null>(null)
  const [grimpeur, setGrimpeur] = useState<{ id: string; nom: string; niveauDeclare: string | null } | null>(null)
  // Centres ou le compte est ouvreur ; `null` dans la liste : tous les centres.
  const [centresOuvreur, setCentresOuvreur] = useState<(string | null)[]>([])
  const { langue } = useLangue()
  const message = useCallback((e: { message: string }) => traduire(e, langue), [langue])
  const [recuperation, setRecuperation] = useState(false)

  useEffect(() => {
    // Lit aussi le retour de Google ou d'un lien de courriel (jetons dans
    // l'adresse), que la bibliotheque transforme elle-meme en session.
    const { data } = supabase.auth.onAuthStateChange((evenement, session) => {
      if (evenement === 'PASSWORD_RECOVERY') setRecuperation(true)
      if (evenement === 'SIGNED_OUT') setRecuperation(false)
      setUserId(session?.user.id ?? null)
      setCourriel(session?.user.email ?? null)
      setSessionLue(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const lireProfil = useCallback(async () => {
    if (!userId) {
      setGrimpeur(null)
      setCentresOuvreur([])
      setProfilLuPour(null)
      return
    }
    const [{ data }, { data: droits }] = await Promise.all([
      supabase
        .from('profils')
        .select('grimpeur_id, grimpeurs(nom, niveau_declare)')
        .eq('user_id', userId)
        .maybeSingle<{ grimpeur_id: string; grimpeurs: { nom: string; niveau_declare: string | null } | null }>(),
      supabase.from('ouvreurs').select('centre_id').eq('user_id', userId).returns<{ centre_id: string | null }[]>(),
    ])
    setGrimpeur(
      data ? { id: data.grimpeur_id, nom: data.grimpeurs?.nom ?? '', niveauDeclare: data.grimpeurs?.niveau_declare ?? null } : null
    )
    setCentresOuvreur((droits ?? []).map((d) => d.centre_id))
    setProfilLuPour(userId)
  }, [userId])

  useEffect(() => {
    void lireProfil()
  }, [lireProfil])

  const connecterGoogle = useCallback(async () => {
    // Quitte la page pour Google, qui revient sur `adresseRetour`.
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: adresseRetour() } })
    return error ? message(error) : null
  }, [message])

  const connecterJetonGoogle = useCallback(
    async (jeton: string, nonce: string) => {
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: jeton, nonce })
      return error ? message(error) : null
    },
    [message]
  )

  const connecter = useCallback(async (adresse: string, motDePasse: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: adresse.trim(), password: motDePasse })
    return error ? message(error) : null
  }, [message])

  const inscrire = useCallback(async (adresse: string, motDePasse: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: adresse.trim(),
      password: motDePasse,
      options: { emailRedirectTo: adresseRetour() },
    })
    return { erreur: error ? message(error) : null, confirmer: !error && !data.session }
  }, [message])

  const oublie = useCallback(async (adresse: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(adresse.trim(), { redirectTo: adresseRetour() })
    return error ? message(error) : null
  }, [message])

  const changerMotDePasse = useCallback(async (motDePasse: string) => {
    const { error } = await supabase.auth.updateUser({ password: motDePasse })
    if (error) return message(error)
    setRecuperation(false)
    return null
  }, [message])

  const creerProfil = useCallback(
    async (pseudo: string, flash: string | null) => {
      const { error } = await supabase.rpc('creer_profil', { pseudo, flash })
      if (error) return error.message
      await lireProfil()
      return null
    },
    [lireProfil]
  )

  const declarerFlash = useCallback(
    async (flash: string) => {
      const { error } = await supabase.rpc('declarer_flash', { flash })
      if (error) return error.message
      await lireProfil()
      return null
    },
    [lireProfil]
  )

  const deconnecter = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const peutOuvrir = useCallback(
    (centreId: string) => centresOuvreur.some((c) => c === null || c === centreId),
    [centresOuvreur]
  )

  const estAdmin = centresOuvreur.includes(null)
  return { pret: sessionLue && profilLuPour === userId, courriel, grimpeur, peutOuvrir, estAdmin, recuperation,
    connecterGoogle, connecterJetonGoogle, connecter, inscrire, oublie, changerMotDePasse, creerProfil, declarerFlash, deconnecter }
}
