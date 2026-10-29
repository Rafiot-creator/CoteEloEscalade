import { useEffect, useRef, useState } from 'react'
import { useLangue } from '../langue'

/**
 * Bouton officiel « Se connecter avec Google » (Google Identity Services).
 *
 * Pourquoi pas une simple redirection vers Google (signInWithOAuth) : Google
 * affiche alors « continuer vers gmopjbpjiwdbnmxbgsxt.supabase.co », le
 * domaine du retour, qui inquiete les gens. Avec ce bouton, la fenetre de
 * Google s'ouvre depuis le site lui-meme ; Google remet un jeton au site, qui
 * le passe a Supabase (signInWithIdToken). Seul un domaine personnalise
 * Supabase (payant) changerait le nom dans le parcours par redirection.
 *
 * Le script de Google n'est charge qu'a l'affichage du bouton (panneau de
 * connexion ouvert), pas sur chaque page. S'il ne charge pas (bloqueur,
 * reseau), `surEchec` laisse l'appelant montrer le bouton de secours.
 */

/** ID client OAuth du projet Google Cloud (public), le meme que dans supabase/config.toml. */
const GOOGLE_CLIENT_ID = '756071274872-qqe2eg37dpr3og29kafn8uklniu12ca3.apps.googleusercontent.com'

interface GoogleId {
  initialize(options: { client_id: string; callback: (r: { credential: string }) => void; nonce: string }): void
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } }
  }
}

let chargement: Promise<GoogleId> | null = null
function chargerGoogle(): Promise<GoogleId> {
  chargement ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => (window.google ? resolve(window.google.accounts.id) : reject(new Error('gsi')))
    script.onerror = () => {
      chargement = null
      script.remove()
      reject(new Error('gsi'))
    }
    document.head.appendChild(script)
  })
  return chargement
}

/**
 * Nonce : Google inscrit son empreinte (SHA-256) dans le jeton, Supabase
 * recoit la valeur brute et verifie qu'elles correspondent. Un jeton
 * intercepte ne peut donc pas etre rejoue dans une autre connexion.
 */
async function nouveauNonce(): Promise<{ brut: string; empreinte: string }> {
  const brut = Array.from(crypto.getRandomValues(new Uint8Array(32)), (o) => o.toString(16).padStart(2, '0')).join('')
  const hache = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(brut))
  const empreinte = Array.from(new Uint8Array(hache), (o) => o.toString(16).padStart(2, '0')).join('')
  return { brut, empreinte }
}

export function BoutonGoogle({
  surJeton,
  surEchec,
}: {
  surJeton: (jeton: string, nonce: string) => void
  surEchec: () => void
}) {
  const { langue } = useLangue()
  const conteneur = useRef<HTMLDivElement>(null)
  const [pret, setPret] = useState(false)
  // Les rappels changent a chaque rendu du parent : on garde le dernier sans
  // reinitialiser Google pour autant.
  const rappels = useRef({ surJeton, surEchec })
  rappels.current = { surJeton, surEchec }

  useEffect(() => {
    let vivant = true
    Promise.all([chargerGoogle(), nouveauNonce()])
      .then(([google, nonce]) => {
        if (!vivant || !conteneur.current) return
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.empreinte,
          callback: (r) => rappels.current.surJeton(r.credential, nonce.brut),
        })
        conteneur.current.replaceChildren()
        google.renderButton(conteneur.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          locale: langue,
          width: 240,
        })
        setPret(true)
      })
      .catch(() => {
        if (vivant) rappels.current.surEchec()
      })
    return () => {
      vivant = false
    }
  }, [langue])

  // Hauteur reservee pendant le chargement, pour que le formulaire en dessous
  // ne saute pas quand le bouton apparait.
  return <div ref={conteneur} style={{ minHeight: 44, opacity: pret ? 1 : 0 }} />
}
