import { useMemo, useState } from 'react'
import { apercuCsv } from '../../core/loaders/csv'
import { SOURCES } from '../../core/sources'
import type { Dataset } from '../../core/types'
import { Carte, Tuile } from '../components/base'
import { nombre, octets } from '../format'
import { bilingue, useLangue } from '../langue'

/**
 * Ce que le site sait de ses propres fichiers : contenu, volume, et surtout
 * ce qu'il a refuse d'y lire. Une donnee ecartee silencieusement est une
 * donnee qu'on retrouve trois semaines plus tard sous forme de resultat faux.
 */
export function VueFichiers({ dataset }: { dataset: Dataset }) {
  const { langue, t } = useLangue()
  const [selection, setSelection] = useState(dataset.fichiers[0]?.chemin ?? '')
  const fichier = dataset.fichiers.find((f) => f.chemin === selection) ?? dataset.fichiers[0]
  const apercu = useMemo(() => (fichier ? apercuCsv(fichier, 150) : null), [fichier])

  const anomalies = dataset.rapport.anomalies
  const erreurs = anomalies.filter((a) => a.gravite === 'erreur')

  return (
    <div className="large">
      <div className="grille tuiles">
        <Tuile
          etiquette={t('Fichiers chargés', 'Loaded files')}
          valeur={nombre(dataset.fichiers.length)}
          note={SOURCES.map((s) => bilingue(s.label, s.labelEn, langue)).join(', ')}
        />
        <Tuile etiquette={t('Grimpeurs', 'Climbers')} valeur={nombre(dataset.grimpeurs.length)} />
        <Tuile etiquette={t('Blocs', 'Boulders')} valeur={nombre(dataset.blocs.length)} />
        <Tuile etiquette={t("Lignes d'ascension", 'Ascent rows')} valeur={nombre(dataset.ascensions.length)} />
        <Tuile
          etiquette={t('Anomalies', 'Anomalies')}
          valeur={nombre(anomalies.length)}
          note={erreurs.length ? t(`${nombre(erreurs.length)} bloquantes`, `${nombre(erreurs.length)} blocking`) : t('aucune erreur', 'no errors')}
        />
      </div>

      <div className="grille deux" style={{ marginTop: 16 }}>
        <Carte
          titre={t('Fichiers du dépôt', 'Repository files')}
          sousTitre={t(
            'Importés à la compilation : leur contenu fait partie du bundle, aucun appel réseau au chargement.',
            'Imported at build time: their content is part of the bundle, no network call on load.'
          )}
        >
          <div className="table-enveloppe">
            <table className="donnees">
              <thead>
                <tr>
                  <th title={t('Chemin du fichier dans le dépôt.', 'Path of the file in the repository.')}>{t('Chemin', 'Path')}</th>
                  <th className="num" title={t('Poids du contenu, tel qu\'il est embarqué dans le bundle.', 'Size of the content, as embedded in the bundle.')}>
                    {t('Taille', 'Size')}
                  </th>
                  <th className="num" title={t("Lignes trouvées dans le fichier, en-tête exclue.", 'Rows found in the file, header excluded.')}>
                    {t('Lignes lues', 'Rows read')}
                  </th>
                  <th
                    className="num"
                    title={t(
                      "Lignes ayant passé la validation. L'écart avec les lignes lues est détaillé dans le contrôle de validité.",
                      'Rows that passed validation. The gap with rows read is detailed in the validity check.'
                    )}
                  >
                    {t('Retenues', 'Kept')}
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
                          <span className="discret">{t('non utilisé', 'not used')}</span>
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
            {t('Ajouter un fichier : le déposer dans', 'To add a file: drop it in')} <span className="mono">data/</span>
            {t(', déclarer son schéma dans', ', declare its schema in')} <span className="mono">src/core/loaders/schemas.ts</span>
            {t(", l'assembler dans", ', assemble it in')} <span className="mono">dataset.ts</span>
            {t(
              ". L'import utilisateur (glisser-déposer) se brancherait comme une seconde source dans",
              '. User import (drag and drop) would plug in as a second source in'
            )}{' '}
            <span className="mono">src/core/sources/</span>
            {t(', sans toucher au reste.', ', without touching the rest.')}
          </p>
        </Carte>

        <Carte
          titre={t('Contrôle de validité', 'Validity check')}
          sousTitre={t('Lignes écartées et incohérences relevées au chargement.', 'Rows discarded and inconsistencies found on load.')}
        >
          {anomalies.length === 0 ? (
            <p className="vide">{t('Aucune anomalie : les trois fichiers sont conformes à leur schéma.', 'No anomalies: all three files conform to their schema.')}</p>
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
          sousTitre={t(
            `Contenu brut, tel que lu — ${nombre(apercu.lignes.length)} premières lignes.`,
            `Raw content, as read — first ${nombre(apercu.lignes.length)} rows.`
          )}
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
