import { useMemo, useState } from 'react'
import { apercuCsv } from '../../core/loaders/csv'
import { SOURCES } from '../../core/sources'
import type { Dataset } from '../../core/types'
import { Carte, Tuile } from '../components/base'
import { nombre, octets } from '../format'

/**
 * Ce que le site sait de ses propres fichiers : contenu, volume, et surtout
 * ce qu'il a refuse d'y lire. Une donnee ecartee silencieusement est une
 * donnee qu'on retrouve trois semaines plus tard sous forme de resultat faux.
 */
export function VueFichiers({ dataset }: { dataset: Dataset }) {
  const [selection, setSelection] = useState(dataset.fichiers[0]?.chemin ?? '')
  const fichier = dataset.fichiers.find((f) => f.chemin === selection) ?? dataset.fichiers[0]
  const apercu = useMemo(() => (fichier ? apercuCsv(fichier, 150) : null), [fichier])

  const anomalies = dataset.rapport.anomalies
  const erreurs = anomalies.filter((a) => a.gravite === 'erreur')

  return (
    <div className="large">
      <div className="grille tuiles">
        <Tuile etiquette="Fichiers charges" valeur={nombre(dataset.fichiers.length)} note={SOURCES.map((s) => s.label).join(', ')} />
        <Tuile etiquette="Grimpeurs" valeur={nombre(dataset.grimpeurs.length)} />
        <Tuile etiquette="Blocs" valeur={nombre(dataset.blocs.length)} />
        <Tuile etiquette="Lignes d'ascension" valeur={nombre(dataset.ascensions.length)} />
        <Tuile
          etiquette="Anomalies"
          valeur={nombre(anomalies.length)}
          note={erreurs.length ? `${nombre(erreurs.length)} bloquantes` : 'aucune erreur'}
        />
      </div>

      <div className="grille deux" style={{ marginTop: 16 }}>
        <Carte
          titre="Fichiers du depot"
          sousTitre="Importes a la compilation : leur contenu fait partie du bundle, aucun appel reseau au chargement."
        >
          <div className="table-enveloppe">
            <table className="donnees">
              <thead>
                <tr>
                  <th title="Chemin du fichier dans le depot.">Chemin</th>
                  <th className="num" title="Poids du contenu, tel qu'il est embarque dans le bundle.">
                    Taille
                  </th>
                  <th className="num" title="Lignes trouvees dans le fichier, en-tete exclue.">
                    Lignes lues
                  </th>
                  <th className="num" title="Lignes ayant passe la validation. L'ecart avec les lignes lues est detaille dans le controle de validite.">
                    Retenues
                  </th>
                </tr>
              </thead>
              <tbody>
                {dataset.fichiers.map((f) => {
                  const lues = dataset.rapport.lignesLues[f.chemin]
                  const gardees = dataset.rapport.lignesRetenues[f.chemin]
                  const actif = f.chemin === fichier?.chemin
                  return (
                    <tr
                      key={f.chemin}
                      onClick={() => setSelection(f.chemin)}
                      style={{ cursor: 'pointer', background: actif ? 'var(--plan-creux)' : undefined }}
                    >
                      <td className="principal mono">{f.chemin}</td>
                      <td className="num">{octets(f.octets)}</td>
                      <td className="num">{lues === undefined ? '—' : nombre(lues)}</td>
                      <td className="num">
                        {gardees === undefined ? (
                          <span className="discret">non utilise</span>
                        ) : (
                          nombre(gardees)
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="param-aide" style={{ marginTop: 10 }}>
            Ajouter un fichier : le deposer dans <span className="mono">data/</span>, declarer son schema dans{' '}
            <span className="mono">src/core/loaders/schemas.ts</span>, l'assembler dans{' '}
            <span className="mono">dataset.ts</span>. L'import utilisateur (glisser-deposer) se brancherait comme une
            seconde source dans <span className="mono">src/core/sources/</span>, sans toucher au reste.
          </p>
        </Carte>

        <Carte
          titre="Controle de validite"
          sousTitre="Lignes ecartees et incoherences relevees au chargement."
        >
          {anomalies.length === 0 ? (
            <p className="vide">Aucune anomalie : les trois fichiers sont conformes a leur schema.</p>
          ) : (
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              {anomalies.map((a, i) => (
                <div className="anomalie" key={i}>
                  <span className="ou">
                    {a.fichier.split('/').pop()}
                    {a.ligne ? `:${a.ligne}` : ''}
                    {a.champ ? ` ${a.champ}` : ''}
                  </span>
                  <span>{a.message}</span>
                  <span className={a.gravite === 'erreur' ? 'puce alerte' : 'puce'} style={{ marginLeft: 'auto' }}>
                    {a.gravite}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Carte>
      </div>

      {fichier && apercu && (
        <Carte
          titre={fichier.nom}
          sousTitre={`Contenu brut, tel que lu — ${nombre(apercu.lignes.length)} premieres lignes.`}
        >
          <div className="table-enveloppe" style={{ maxHeight: 420, overflow: 'auto' }}>
            <table className="donnees">
              <thead>
                <tr>
                  <th className="num discret">#</th>
                  {apercu.colonnes.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apercu.lignes.map((l, i) => (
                  <tr key={i}>
                    <td className="num discret">{i + 2}</td>
                    {l.map((v, j) => (
                      <td key={j} className={j === 0 ? 'mono' : undefined}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Carte>
      )}
    </div>
  )
}
