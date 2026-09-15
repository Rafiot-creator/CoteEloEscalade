import type { Ascension } from '../core/types'

/**
 * Ascensions ajoutees depuis la Carte (boutons flash / reussi / echec), en
 * plus de celles chargees depuis `data/ascensions.csv`.
 *
 * A la difference de `suiviLocal` (un simple drapeau "envoye", qui n'entre
 * dans aucun calcul), ce sont de vraies lignes du modele — memes champs que
 * le CSV — melangees aux ascensions du dataset avant de lancer les formules
 * (cf. `useAtelier`). C'est ce qui les rend "coherentes avec l'ensemble du
 * fichier de donnees" plutot qu'un suivi purement visuel.
 *
 * Comme `suiviLocal`, c'est aujourd'hui propre a ce navigateur (localStorage) :
 * pas de comptes, pas de partage entre appareils. Le jour de vrais comptes,
 * une implementation appuyee sur un serveur remplace `ascensionsLocales` sans
 * que le reste (pipeline, formules, interface) ne change.
 */
export interface AscensionLocaleProvider {
  id: string
  lire(): Ascension[]
  ajouter(ascension: Ascension): void
  /** Remplace la liste entiere : sert a annuler un envoi mal clique. */
  ecrire(ascensions: Ascension[]): void
}

const CLE = 'cee-ascensions-locales'

export const ascensionsLocales: AscensionLocaleProvider = {
  id: 'local',
  lire() {
    try {
      const brut = localStorage.getItem(CLE)
      return brut ? (JSON.parse(brut) as Ascension[]) : []
    } catch {
      return []
    }
  },
  ajouter(ascension) {
    const actuel = ascensionsLocales.lire()
    actuel.push(ascension)
    ascensionsLocales.ecrire(actuel)
  },
  ecrire(ascensions) {
    try {
      localStorage.setItem(CLE, JSON.stringify(ascensions))
    } catch {
      // Navigation privee ou stockage plein : l'ecriture ne persiste pas
      // au-dela de cette visite, ce qui est un echec sans consequence.
    }
  },
}
