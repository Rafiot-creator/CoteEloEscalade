import { useMemo, useState, type ReactNode } from 'react'
import { useInfobulle } from '../charts/base'
import { nombre } from '../format'
import { useLangue } from '../langue'

export interface Colonne<T> {
  cle: string
  titre: string
  /**
   * Rendu personnalise de l'en-tete (ex. un menu deroulant), affiche a la
   * place de `titre`. `titre` reste utilise pour l'aide et le texte du tri.
   */
  titreRendu?: () => ReactNode
  /** Aligne a droite, chiffres alignes verticalement. */
  num?: boolean
  /** Colonne d'identite : mise en avant typographique. */
  principal?: boolean
  /** Valeur affichee (et valeur de tri par defaut). */
  valeur: (ligne: T) => string | number | null
  /** Rendu riche optionnel ; `valeur` reste la source du tri et de l'export. */
  rendu?: (ligne: T) => ReactNode
  /** Cle de tri si elle differe de la valeur affichee. */
  tri?: (ligne: T) => string | number
  /**
   * Ce que la colonne veut dire, montre au survol de son en-tete. Une colonne
   * dont le titre ne suffit pas a se faire comprendre devrait en avoir une.
   */
  aide?: string
}

interface Props<T> {
  lignes: T[]
  colonnes: Colonne<T>[]
  cleLigne: (ligne: T) => string
  triInitial?: { cle: string; sens: 1 | -1 }
  /**
   * Tri pilote depuis l'exterieur (ex. changer le style choisi dans l'en-tete
   * d'une colonne doit aussi retrier le tableau sur cette colonne) : quand
   * fourni avec `onTri`, remplace l'etat interne comme source de verite. Un
   * clic sur un en-tete continue de fonctionner, via `onTri`.
   */
  tri?: { cle: string; sens: 1 | -1 }
  onTri?: (tri: { cle: string; sens: 1 | -1 }) => void
  /** Nombre de lignes affichees d'un coup. */
  pageTaille?: number
  videMessage?: string
}

/**
 * Tableau triable et pagine.
 *
 * Il sert aussi de *vue tabulaire* aux graphiques : chaque graphe du site a son
 * equivalent en tableau, pour que rien ne soit accessible uniquement par la
 * couleur ou par le survol.
 */
export function Tableau<T>({
  lignes,
  colonnes,
  cleLigne,
  triInitial,
  tri: triPilote,
  onTri,
  pageTaille = 50,
  videMessage,
}: Props<T>) {
  const [triInterne, setTriInterne] = useState(triInitial ?? { cle: colonnes[0].cle, sens: 1 as 1 | -1 })
  const tri = triPilote ?? triInterne
  const changerTri = onTri ?? setTriInterne
  const [limite, setLimite] = useState(pageTaille)
  const { montrer, cacher, noeud } = useInfobulle()
  const { langue, t } = useLangue()

  const triees = useMemo(() => {
    const col = colonnes.find((c) => c.cle === tri.cle)
    if (!col) return lignes
    const cle = col.tri ?? ((l: T) => col.valeur(l) ?? '')
    return [...lignes].sort((a, b) => {
      const va = cle(a)
      const vb = cle(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * tri.sens
      return String(va).localeCompare(String(vb), langue === 'fr' ? 'fr' : 'en') * tri.sens
    })
  }, [lignes, colonnes, tri, langue])

  if (!lignes.length) return <p className="vide">{videMessage ?? t('Aucune ligne.', 'No rows.')}</p>

  const visibles = triees.slice(0, limite)

  return (
    <>
      <div className="table-enveloppe">
        <table className="donnees">
          <thead>
            <tr>
              {colonnes.map((c) => (
                <th
                  key={c.cle}
                  className={[c.num ? 'num' : '', c.aide ? 'avec-aide' : ''].filter(Boolean).join(' ') || undefined}
                  onClick={() =>
                    changerTri(tri.cle === c.cle ? { cle: c.cle, sens: (tri.sens * -1) as 1 | -1 } : { cle: c.cle, sens: c.num ? -1 : 1 })
                  }
                  onMouseMove={(e) =>
                    c.aide && montrer(e, { titre: c.titre, texte: c.aide, lignes: [['', t('Cliquer pour trier', 'Click to sort')]] })
                  }
                  onMouseLeave={cacher}
                >
                  {c.titreRendu ? c.titreRendu() : c.titre}
                  {tri.cle === c.cle && <span className="tri">{tri.sens === 1 ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr key={cleLigne(l)}>
                {colonnes.map((c) => {
                  const v = c.valeur(l)
                  return (
                    <td
                      key={c.cle}
                      className={[c.num ? 'num' : '', c.principal ? 'principal' : ''].filter(Boolean).join(' ') || undefined}
                    >
                      {c.rendu ? c.rendu(l) : typeof v === 'number' ? nombre(v) : (v ?? '—')}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {noeud}
      <div className="pagination">
        <span>
          {t(`${nombre(visibles.length)} sur ${nombre(lignes.length)} lignes`, `${nombre(visibles.length)} of ${nombre(lignes.length)} rows`)}
        </span>
        {limite < lignes.length && (
          <button className="bouton" onClick={() => setLimite((l) => l + pageTaille * 4)}>
            {t('Afficher plus', 'Show more')}
          </button>
        )}
        {limite > pageTaille && (
          <button className="bouton discret" onClick={() => setLimite(pageTaille)}>
            {t('Replier', 'Collapse')}
          </button>
        )}
      </div>
    </>
  )
}
