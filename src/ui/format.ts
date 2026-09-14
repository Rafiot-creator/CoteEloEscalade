/** Formatage : un seul endroit, pour que tous les chiffres du site se ressemblent. */

export type Langue = 'fr' | 'en'

/**
 * Langue courante, modifiee par `LangueProvider` (voir `langue.tsx`).
 *
 * Ces fonctions sont des utilitaires purs appeles pendant le rendu, pas des
 * composants : elles ne peuvent pas lire le contexte React directement. Un
 * etat de module suffit ici, puisqu'il n'y a qu'une langue active a la fois
 * et que tout composant qui affiche un nombre est de toute facon reaffiche
 * quand la langue change (il consomme `useLangue` plus haut dans l'arbre).
 */
let langueCourante: Langue = 'fr'

export function definirLangueFormat(l: Langue): void {
  langueCourante = l
}

const creerFormatteurs = (locale: string) => ({
  0: new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  1: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  2: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
})

const formatteurs = { fr: creerFormatteurs('fr-FR'), en: creerFormatteurs('en-US') }

export const nombre = (v: number, decimales = 0): string => {
  if (!Number.isFinite(v)) return '—'
  const f = formatteurs[langueCourante]
  return decimales === 0 ? f[0].format(v) : decimales === 1 ? f[1].format(v) : f[2].format(v)
}

export const pourcent = (v: number, decimales = 0): string => {
  if (!Number.isFinite(v)) return '—'
  return langueCourante === 'fr' ? `${nombre(v * 100, decimales)} %` : `${nombre(v * 100, decimales)}%`
}

/** Ecart signe en crans : '+1,4' / '−0,6' / '0' ('+1.4' / '−0.6' / '0' en anglais). */
export function signe(v: number, decimales = 1): string {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) < 0.05) return '0'
  return (v > 0 ? '+' : '−') + nombre(Math.abs(v), decimales)
}

export function octets(n: number): string {
  const unites = langueCourante === 'fr' ? ['o', 'ko', 'Mo'] : ['B', 'KB', 'MB']
  if (n < 1024) return `${n} ${unites[0]}`
  if (n < 1024 * 1024) return `${nombre(n / 1024, 1)} ${unites[1]}`
  return `${nombre(n / (1024 * 1024), 1)} ${unites[2]}`
}

export function dateCourte(t: number): string {
  const locale = langueCourante === 'fr' ? 'fr-FR' : 'en-US'
  return new Date(t).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: '2-digit' })
}

export function mois(t: number): string {
  const locale = langueCourante === 'fr' ? 'fr-FR' : 'en-US'
  return new Date(t).toLocaleDateString(locale, { month: 'short', year: '2-digit' })
}

/** Telecharge un contenu genere cote client. */
export function telecharger(nomFichier: string, contenu: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  a.click()
  URL.revokeObjectURL(url)
}
