/**
 * Suivi "j'ai envoye ce bloc", par grimpeur nomme.
 *
 * Le site n'a pas de comptes : ce suivi est aujourd'hui propre a chaque
 * navigateur (localStorage), pas partage entre appareils, pas verifie (rien
 * n'empeche de taper le nom de quelqu'un d'autre), et n'entre dans aucun
 * calcul Elo. C'est deliberement derriere une interface (`SuiviProvider`)
 * plutot qu'un acces direct a localStorage : le jour de vrais comptes, une
 * implementation appuyee sur un serveur vient remplacer `suiviLocal` sans
 * que les composants qui l'utilisent ne changent.
 *
 * Un meme navigateur peut suivre plusieurs grimpeurs (utile sur un appareil
 * partage, par exemple une tablette au centre) : le suivi est garde par
 * couple (centre, grimpeur), et le grimpeur choisi est lui-meme memorise
 * par centre pour ne pas avoir a le retaper a chaque visite.
 */
export interface SuiviProvider {
  id: string
  lire(centreId: string, grimpeur: string): Record<string, boolean>
  definir(centreId: string, grimpeur: string, blocId: string, envoye: boolean): void
}

const cleSuivi = (centreId: string, grimpeur: string) => `cee-suivi-${centreId}-${grimpeur.trim() || 'moi'}`

export const suiviLocal: SuiviProvider = {
  id: 'local',
  lire(centreId, grimpeur) {
    try {
      const brut = localStorage.getItem(cleSuivi(centreId, grimpeur))
      return brut ? (JSON.parse(brut) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  },
  definir(centreId, grimpeur, blocId, envoye) {
    const actuel = suiviLocal.lire(centreId, grimpeur)
    actuel[blocId] = envoye
    try {
      localStorage.setItem(cleSuivi(centreId, grimpeur), JSON.stringify(actuel))
    } catch {
      // Navigation privee ou stockage plein : le suivi ne persiste pas pour
      // cette visite, ce qui est un echec sans consequence.
    }
  },
}

const cleGrimpeurChoisi = (centreId: string) => `cee-grimpeur-choisi-${centreId}`

export function lireGrimpeurChoisi(centreId: string): string {
  try {
    return localStorage.getItem(cleGrimpeurChoisi(centreId)) ?? ''
  } catch {
    return ''
  }
}

export function definirGrimpeurChoisi(centreId: string, grimpeur: string): void {
  try {
    localStorage.setItem(cleGrimpeurChoisi(centreId), grimpeur)
  } catch {
    // Idem : sans consequence au-dela de cette visite.
  }
}
