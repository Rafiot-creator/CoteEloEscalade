/**
 * Suivi personnel "j'ai envoye ce bloc", cote visiteur.
 *
 * Le site n'a pas de comptes : ce suivi est aujourd'hui propre a chaque
 * navigateur (localStorage), pas partage entre visiteurs, pas relie a un
 * vrai nom, et n'entre dans aucun calcul Elo. C'est deliberement derriere
 * une interface (`SuiviProvider`) plutot qu'un acces direct a localStorage :
 * le jour de vrais comptes, une implementation appuyee sur un serveur vient
 * remplacer `suiviLocal` sans que les composants qui l'utilisent ne changent.
 */
export interface SuiviProvider {
  id: string
  lire(centreId: string): Record<string, boolean>
  definir(centreId: string, blocId: string, envoye: boolean): void
}

const cle = (centreId: string) => `cee-suivi-${centreId}`

export const suiviLocal: SuiviProvider = {
  id: 'local',
  lire(centreId) {
    try {
      const brut = localStorage.getItem(cle(centreId))
      return brut ? (JSON.parse(brut) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  },
  definir(centreId, blocId, envoye) {
    const actuel = suiviLocal.lire(centreId)
    actuel[blocId] = envoye
    try {
      localStorage.setItem(cle(centreId), JSON.stringify(actuel))
    } catch {
      // Navigation privee ou stockage plein : le suivi ne persiste pas pour
      // cette visite, ce qui est un echec sans consequence.
    }
  },
}
