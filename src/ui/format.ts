/** Formatage : un seul endroit, pour que tous les chiffres du site se ressemblent. */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max })

const entier = nf(0, 0)
const un = nf(1, 1)
const deux = nf(2, 2)

export const nombre = (v: number, decimales = 0): string =>
  !Number.isFinite(v) ? '—' : decimales === 0 ? entier.format(v) : decimales === 1 ? un.format(v) : deux.format(v)

export const pourcent = (v: number, decimales = 0): string =>
  !Number.isFinite(v) ? '—' : `${nombre(v * 100, decimales)} %`

/** Ecart signe en crans : '+1,4' / '−0,6' / '0'. */
export function signe(v: number, decimales = 1): string {
  if (!Number.isFinite(v)) return '—'
  if (Math.abs(v) < 0.05) return '0'
  return (v > 0 ? '+' : '−') + nombre(Math.abs(v), decimales)
}

export function octets(n: number): string {
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${nombre(n / 1024, 1)} ko`
  return `${nombre(n / (1024 * 1024), 1)} Mo`
}

export function dateCourte(t: number): string {
  return new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function mois(t: number): string {
  return new Date(t).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
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
