import type { Formule } from './types'

/**
 * Registre auto-decouvert.
 *
 * Tout fichier de `definitions/` qui exporte par defaut une `Formule` est
 * ramasse ici a la compilation et apparait dans l'interface. Il n'y a
 * volontairement aucune liste a tenir a jour : oublier d'enregistrer sa
 * formule est une erreur qu'on ne peut pas commettre.
 */
const modules = import.meta.glob('./definitions/*.ts', { eager: true }) as Record<
  string,
  { default?: Formule }
>

export const FORMULES: Formule[] = Object.entries(modules)
  .map(([chemin, mod]) => {
    if (!mod.default) {
      throw new Error(`${chemin} : une definition de formule doit faire un export par defaut.`)
    }
    return mod.default
  })
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'))

const parId = new Map(FORMULES.map((f) => [f.id, f]))

export function formuleParId(id: string): Formule | undefined {
  return parId.get(id)
}

/**
 * Le melange est la formule montree en premier : c'est celle qui fait le moins
 * de grosses erreurs (erreur quadratique 0,296 contre 0,318 et 0,350), et elle
 * n'est jugeable que la ou les deux composantes le sont, ce qui la rend plus
 * prudente sur les blocs mal documentes.
 */
export const FORMULE_PAR_DEFAUT = formuleParId('melange') ?? FORMULES[0]
