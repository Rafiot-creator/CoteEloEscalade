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

export const FORMULE_PAR_DEFAUT = formuleParId('elo-bloc') ?? FORMULES[0]
