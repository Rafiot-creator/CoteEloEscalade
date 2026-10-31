import { useState } from 'react'

/**
 * Petites preferences d'affichage retenues dans ce navigateur (tri d'un
 * tableau, style choisi dans un menu...) : un aller-retour vers un autre onglet
 * (qui demonte l'ecran) ou un rafraichissement les conserve, tant que
 * l'utilisateur n'en choisit pas d'autres (demande de Raphael). Simple
 * commodite : si le stockage est indisponible (navigation privee) ou la valeur
 * illisible, on repart du defaut.
 */
export type Tri = { cle: string; sens: 1 | -1 }

const PREFIXE_TRI = 'cee-tri-'

function lireTri(nom: string, defaut: Tri): Tri {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIXE_TRI + nom) ?? 'null')
    if (v && typeof v.cle === 'string' && (v.sens === 1 || v.sens === -1)) return { cle: v.cle, sens: v.sens }
  } catch {
    // Stockage indisponible ou valeur illisible.
  }
  return defaut
}

function ecrire(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur)
  } catch {
    // Stockage indisponible : rien a retenir.
  }
}

/** Tri d'un tableau, retenu sous `nom` (sans nom : simple etat, rien retenu). */
export function useTriMemorise(nom: string | undefined, defaut: Tri): [Tri, (tri: Tri) => void] {
  const [tri, setTri] = useState(() => (nom ? lireTri(nom, defaut) : defaut))
  const changer = (nouveau: Tri) => {
    setTri(nouveau)
    if (nom) ecrire(PREFIXE_TRI + nom, JSON.stringify(nouveau))
  }
  return [tri, changer]
}

/** Choix parmi une liste de valeurs, retenu sous `cle`. */
export function useChoixMemorise<V extends string>(cle: string, valides: readonly V[], defaut: V): [V, (v: V) => void] {
  const [v, setV] = useState<V>(() => {
    try {
      const lu = localStorage.getItem(cle)
      if (lu !== null && (valides as readonly string[]).includes(lu)) return lu as V
    } catch {
      // Stockage indisponible.
    }
    return defaut
  })
  const changer = (nouveau: V) => {
    setV(nouveau)
    ecrire(cle, nouveau)
  }
  return [v, changer]
}
