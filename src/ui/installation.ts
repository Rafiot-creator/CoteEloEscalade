import { useEffect, useState } from 'react'

/**
 * Installation de l'application (PWA, cf. public/sw.js et README, « L'application
 * installable »), pour l'onglet Telecharger.
 *
 * Chrome, Edge et Android proposent une invite d'installation que le site peut
 * declencher lui-meme depuis un bouton : il faut pour cela retenir l'evenement
 * `beforeinstallprompt`, qui peut arriver avant que React ait affiche quoi que
 * ce soit — d'ou l'ecoute des le chargement de ce module. Safari (iPhone, Mac)
 * n'a rien de tel : seules des instructions sont possibles.
 */
interface InviteInstallation extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let inviteRetenue: InviteInstallation | null = null
let installeeIci = false
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Pas de bandeau automatique du navigateur : c'est l'onglet qui propose.
    e.preventDefault()
    inviteRetenue = e as InviteInstallation
    prevenir()
  })
  window.addEventListener('appinstalled', () => {
    inviteRetenue = null
    installeeIci = true
    prevenir()
  })
}

/** Ouvert depuis l'icone de l'application installee (et non dans un navigateur). */
export function estDansApplication(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export type Plateforme = 'ios' | 'android' | 'ordinateur'

function plateforme(): Plateforme {
  const ua = navigator.userAgent
  // Un iPad recent se presente comme un Mac : on le reconnait a son ecran tactile.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'ordinateur'
}

export interface Installation {
  /** Ouvert depuis l'application installee : rien a proposer. */
  dansApplication: boolean
  /** Installation acceptee pendant cette visite. */
  installee: boolean
  plateforme: Plateforme
  /** Ouvre l'invite du navigateur, si celui-ci en propose une. */
  installer: (() => Promise<boolean>) | null
}

export function useInstallation(): Installation {
  const [, rafraichir] = useState(0)
  useEffect(() => {
    const f = () => rafraichir((n) => n + 1)
    abonnes.add(f)
    return () => void abonnes.delete(f)
  }, [])
  const invite = inviteRetenue
  return {
    dansApplication: estDansApplication(),
    installee: installeeIci,
    plateforme: plateforme(),
    installer: invite
      ? async () => {
          await invite.prompt()
          const { outcome } = await invite.userChoice
          // Une invite ne sert qu'une fois, acceptee ou non.
          inviteRetenue = null
          if (outcome === 'accepted') installeeIci = true
          prevenir()
          return outcome === 'accepted'
        }
      : null,
  }
}
