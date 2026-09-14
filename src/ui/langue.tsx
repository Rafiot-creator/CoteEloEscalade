import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { definirLangueFormat, type Langue } from './format'

export type { Langue }

interface ContexteLangue {
  langue: Langue
  definir: (l: Langue) => void
  /** Choisit la bonne chaine selon la langue courante : t('Bloc', 'Boulder'). */
  t: (fr: string, en: string) => string
}

const Contexte = createContext<ContexteLangue | null>(null)

/**
 * Pas de persistance (localStorage) : comme le theme clair/sombre, la langue
 * repart en francais a chaque chargement. Coherent avec le reste du site, et
 * evite une dependance de plus pour un choix qui se refait en un clic.
 */
export function LangueProvider({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>('fr')

  const definir = (l: Langue) => {
    definirLangueFormat(l)
    setLangue(l)
  }

  const valeur = useMemo<ContexteLangue>(
    () => ({ langue, definir, t: (fr, en) => (langue === 'fr' ? fr : en) }),
    [langue]
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useLangue(): ContexteLangue {
  const ctx = useContext(Contexte)
  if (!ctx) throw new Error('useLangue doit etre appele sous LangueProvider')
  return ctx
}

/**
 * Choisit la variante anglaise d'un champ de donnees (label, aide...) porte
 * par `src/core/`, si elle existe et que l'anglais est actif. A defaut,
 * retombe sur le francais : une formule ou un parametre ajoute sans
 * traduction reste utilisable, simplement pas encore traduit.
 */
export function bilingue(fr: string, en: string | undefined, langue: Langue): string
export function bilingue(fr: string | undefined, en: string | undefined, langue: Langue): string | undefined
export function bilingue(fr: string | undefined, en: string | undefined, langue: Langue): string | undefined {
  return langue === 'en' && en ? en : fr
}
