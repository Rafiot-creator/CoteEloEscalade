import { useMemo, useState, type ReactNode } from 'react'
import { nombre } from '../format'

export interface Colonne<T> {
  cle: string
  titre: string
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
}

interface Props<T> {
  lignes: T[]
  colonnes: Colonne<T>[]
  cleLigne: (ligne: T) => string
  triInitial?: { cle: string; sens: 1 | -1 }
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
  pageTaille = 50,
  videMessage = 'Aucune ligne.',
}: Props<T>) {
  const [tri, setTri] = useState(triInitial ?? { cle: colonnes[0].cle, sens: 1 as 1 | -1 })
  const [limite, setLimite] = useState(pageTaille)

  const triees = useMemo(() => {
    const col = colonnes.find((c) => c.cle === tri.cle)
    if (!col) return lignes
    const cle = col.tri ?? ((l: T) => col.valeur(l) ?? '')
    return [...lignes].sort((a, b) => {
      const va = cle(a)
      const vb = cle(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * tri.sens
      return String(va).localeCompare(String(vb), 'fr') * tri.sens
    })
  }, [lignes, colonnes, tri])

  if (!lignes.length) return <p className="vide">{videMessage}</p>

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
                  className={c.num ? 'num' : undefined}
                  onClick={() =>
                    setTri((t) => (t.cle === c.cle ? { cle: c.cle, sens: (t.sens * -1) as 1 | -1 } : { cle: c.cle, sens: c.num ? -1 : 1 }))
                  }
                  title="Trier"
                >
                  {c.titre}
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
      <div className="pagination">
        <span>
          {nombre(visibles.length)} sur {nombre(lignes.length)} lignes
        </span>
        {limite < lignes.length && (
          <button className="bouton" onClick={() => setLimite((l) => l + pageTaille * 4)}>
            Afficher plus
          </button>
        )}
        {limite > pageTaille && (
          <button className="bouton discret" onClick={() => setLimite(pageTaille)}>
            Replier
          </button>
        )}
      </div>
    </>
  )
}
