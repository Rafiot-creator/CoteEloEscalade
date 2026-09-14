import { useEffect, useState } from 'react'

/**
 * Site statique sans serveur ni compte : ce "mode complet" n'est qu'un
 * masquage d'interface, pas une vraie protection. Le secret est visible dans
 * le bundle JS par quiconque regarde le code source. Il sert juste a ne pas
 * montrer les onglets techniques aux visiteurs occasionnels.
 */
const CLE_STOCKAGE = 'cee-acces-complet'
const PARAM_URL = 'cle'
const SECRET = 'coteelo-9f2k7q3v'

export function useAccesComplet(): boolean {
  const [complet, setComplet] = useState(() => {
    try {
      return localStorage.getItem(CLE_STOCKAGE) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get(PARAM_URL) !== SECRET) return

    try {
      localStorage.setItem(CLE_STOCKAGE, '1')
    } catch {
      // navigateur qui bloque localStorage (navigation privee) : l'acces
      // reste limite a cette visite, ce qui est un echec sans consequence.
    }
    setComplet(true)

    params.delete(PARAM_URL)
    const reste = params.toString()
    const nouvelleUrl = window.location.pathname + (reste ? `?${reste}` : '') + window.location.hash
    window.history.replaceState({}, '', nouvelleUrl)
  }, [])

  return complet
}
