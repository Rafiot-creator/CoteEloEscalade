import { PARAMS_CALIBRAGE, pointsParCran } from '../../core/calibrage'
import type { Diagnostic } from '../../core/formulas/types'
import type { Resultat } from '../../core/pipeline'
import { MiniCourbe } from '../charts/Courbes'
import { Carte, PanneauParams, Tuile } from '../components/base'
import { bilingue, useLangue } from '../langue'
import { nombre, pourcent, signe } from '../format'
import type { Atelier } from '../etat'

/**
 * L'atelier de reglage.
 *
 * Toute la colonne de gauche est generee a partir des declarations de la
 * formule choisie : cet ecran ne connait aucune formule en particulier.
 */
export function VueFormules({ atelier }: { atelier: Atelier }) {
  const { langue, t } = useLangue()
  const { formule, formules, params, paramsCalibrage, resultat, reference } = atelier
  if (!resultat) return null

  return (
    <div className="large">
      <div className="grille atelier">
        <div>
          <Carte titre={t('Formule', 'Formula')} sousTitre={bilingue(formule.description, formule.descriptionEn, langue)}>
            <select value={formule.id} onChange={(e) => atelier.choisirFormule(e.currentTarget.value)}>
              {formules.map((f) => (
                <option key={f.id} value={f.id}>
                  {bilingue(f.label, f.labelEn, langue)}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 12 }}>
              <PanneauParams specs={formule.params} valeurs={params} onChange={atelier.setParam} />
            </div>
          </Carte>

          <Carte
            titre={t('Calibrage', 'Calibration')}
            sousTitre={t(
              "Conversion de la cote Elo, unité interne au modèle, vers l'échelle V.",
              'Conversion from the Elo rating (the model\'s internal unit) to the V scale.'
            )}
          >
            <PanneauParams specs={PARAMS_CALIBRAGE} valeurs={paramsCalibrage} onChange={atelier.setParamCalibrage} />
          </Carte>

          <Carte>
            <div className="barre-outils" style={{ margin: 0 }}>
              <button className="bouton" onClick={atelier.reinitialiser}>
                {t('Valeurs par défaut', 'Default values')}
              </button>
              <button className="bouton" onClick={atelier.memoriser}>
                {t('Mémoriser ce réglage', 'Remember this setting')}
              </button>
              {reference && (
                <button className="bouton discret" onClick={atelier.oublier}>
                  {t('Oublier', 'Forget')}
                </button>
              )}
            </div>
          </Carte>
        </div>

        <div>
          <Carte
            titre={t('Qualité du calcul', 'Calculation quality')}
            sousTitre={t(
              `${resultat.formuleLabel} — ${nombre(resultat.dureeMs)} ms — ${nombre(resultat.resume.duelsComptes)} duels comptés sur ${nombre(resultat.resume.duels)} affrontements.`,
              `${bilingue(resultat.formuleLabel, formules.find((f) => f.id === resultat.formuleId)?.labelEn, langue)} — ${nombre(resultat.dureeMs)} ms — ${nombre(resultat.resume.duelsComptes)} counted duels out of ${nombre(resultat.resume.duels)} matchups.`
            )}
          >
            <div className="grille tuiles">
              {resultat.diagnostics.map((d) => (
                <TuileDiagnostic
                  key={d.label}
                  d={d}
                  precedent={reference?.resultat.diagnostics.find((x) => x.label === d.label)}
                />
              ))}
            </div>
          </Carte>

          <Carte
            titre={t('Convergence', 'Convergence')}
            sousTitre={t(
              "Correction moyenne appliquée à chaque passe. La courbe doit s'aplatir : si elle ne descend pas, augmenter le nombre de passes.",
              'Average correction applied at each pass. The curve should flatten out: if it does not go down, increase the number of passes.'
            )}
          >
            <MiniCourbe valeurs={resultat.convergence} />
            <div className="legende" style={{ marginTop: 4 }}>
              <span className="discret">
                {t(
                  `passe 1 : ${nombre(resultat.convergence[0] ?? 0, 2)} pts · dernière passe : ${nombre(resultat.convergence[resultat.convergence.length - 1] ?? 0, 2)} pts`,
                  `pass 1: ${nombre(resultat.convergence[0] ?? 0, 2)} pts · last pass: ${nombre(resultat.convergence[resultat.convergence.length - 1] ?? 0, 2)} pts`
                )}
              </span>
            </div>
          </Carte>

          <Carte titre={t('Échelle obtenue', 'Resulting scale')} sousTitre={t('Ce que vaut une cote V, dans l\'unité du modèle.', 'What one V grade is worth, in the model\'s unit.')}>
            <div className="grille tuiles">
              <Tuile
                etiquette={t('Points par cote V', 'Points per V grade')}
                valeur={nombre(pointsParCran(resultat.calibrage))}
                unite="pts"
                note={resultat.calibrage.mode === 'auto' ? t('déduit des données', 'derived from the data') : t('fixé manuellement', 'set manually')}
              />
              {resultat.calibrage.mode === 'auto' ? (
                <Tuile
                  etiquette={t('Ajustement (r²)', 'Fit (r²)')}
                  valeur={nombre(resultat.calibrage.r2, 2)}
                  note={t(`régression sur ${nombre(resultat.calibrage.nBlocs)} blocs`, `regression on ${nombre(resultat.calibrage.nBlocs)} boulders`)}
                />
              ) : (
                <Tuile
                  etiquette={t('Méthode', 'Method')}
                  valeur={t('Échelle fixe', 'Fixed scale')}
                  note={t(
                    'Passer en mode régression pour voir combien de points séparent réellement deux cotes dans vos données.',
                    'Switch to regression mode to see how many points actually separate two grades in your data.'
                  )}
                />
              )}
              <Tuile
                etiquette={t('Blocs exploitables', 'Ratable boulders')}
                valeur={nombre(resultat.resume.blocsAudites)}
                note={t(`sur ${nombre(resultat.resume.blocsTotal)}`, `out of ${nombre(resultat.resume.blocsTotal)}`)}
              />
              <Tuile
                etiquette={t('Écart médian', 'Median gap')}
                valeur={nombre(resultat.resume.ecartMedianAbs, 2)}
                unite={t('cote V', 'V grade')}
                note={t('calcul contre cotation affichée', 'calculated vs. displayed grade')}
              />
            </div>
            {resultat.calibrage.avertissement && (
              <p className="param-aide" style={{ color: 'var(--critique)', marginTop: 10 }}>
                {bilingue(resultat.calibrage.avertissement, resultat.calibrage.avertissementEn, langue)}
              </p>
            )}
          </Carte>

          {reference && <Comparaison courant={resultat} reference={reference} />}
        </div>
      </div>
    </div>
  )
}

function TuileDiagnostic({ d, precedent }: { d: Diagnostic; precedent?: Diagnostic }) {
  const { langue, t } = useLangue()
  const delta = precedent ? d.valeur - precedent.valeur : null
  const mieux = delta === null || Math.abs(delta) < 1e-9 ? null : d.basMieux ? delta < 0 : delta > 0
  return (
    <Tuile
      etiquette={bilingue(d.label, d.labelEn, langue)}
      valeur={nombre(d.valeur, d.valeur < 10 ? 3 : 0)}
      unite={d.unite}
      note={
        delta === null ? (
          bilingue(d.aide, d.aideEn, langue)
        ) : (
          <span style={{ color: mieux === null ? undefined : mieux ? 'var(--bon)' : 'var(--critique)' }}>
            {t(`${signe(delta, 3)} vs réglage mémorisé`, `${signe(delta, 3)} vs remembered setting`)}
          </span>
        )
      }
    />
  )
}

/**
 * Comparaison A/B. Deux jeux de reglages produisent deux cotations pour la
 * meme voie : ce tableau montre ou ils divergent le plus, ce qui est la seule
 * facon honnete de juger si un parametre "change quelque chose".
 */
function Comparaison({ courant, reference }: { courant: Resultat; reference: { resultat: Resultat; etiquette: string } }) {
  const { t } = useLangue()
  const parId = new Map(reference.resultat.blocs.map((b) => [b.id, b]))
  const divergences = courant.blocs
    .filter((b) => b.fiable)
    .map((b) => ({ v: b, avant: parId.get(b.id) }))
    .filter((d): d is { v: (typeof courant.blocs)[number]; avant: (typeof courant.blocs)[number] } => Boolean(d.avant))
    .map((d) => ({ ...d, delta: d.v.indexCalcule - d.avant.indexCalcule }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const deplacementMoyen = divergences.length
    ? divergences.reduce((s, d) => s + Math.abs(d.delta), 0) / divergences.length
    : 0

  return (
    <Carte
      titre={t('Comparaison avec le réglage mémorisé', 'Comparison with the remembered setting')}
      sousTitre={t(
        `${reference.etiquette} → ${courant.formuleLabel}. Blocs dont la cotation calculée bouge le plus.`,
        `${reference.etiquette} → ${courant.formuleLabel}. Boulders whose calculated grade moves the most.`
      )}
    >
      <div className="grille tuiles" style={{ marginBottom: 12 }}>
        <Tuile etiquette={t('Déplacement moyen', 'Average shift')} valeur={nombre(deplacementMoyen, 2)} unite={t('cote V', 'V grade')} />
        <Tuile
          etiquette={t("Blocs déplacés d'une cote ou plus", 'Boulders shifted a grade or more')}
          valeur={nombre(divergences.filter((d) => Math.abs(d.delta) >= 1).length)}
          note={t(`sur ${nombre(divergences.length)}`, `out of ${nombre(divergences.length)}`)}
        />
        <Tuile
          etiquette={t("Désaccords avec l'ouvreur", 'Disagreements with the setter')}
          valeur={nombre(courant.resume.desaccords)}
          note={t(`était ${nombre(reference.resultat.resume.desaccords)}`, `was ${nombre(reference.resultat.resume.desaccords)}`)}
        />
      </div>
      <div className="table-enveloppe">
        <table className="donnees">
          <thead>
            <tr>
              <th>{t('Bloc', 'Boulder')}</th>
              <th>{t('Affichée', 'Displayed')}</th>
              <th>{t('Mémorisé', 'Remembered')}</th>
              <th>{t('Courant', 'Current')}</th>
              <th className="num">{t('Déplacement', 'Shift')}</th>
            </tr>
          </thead>
          <tbody>
            {divergences.slice(0, 12).map((d) => (
              <tr key={d.v.id}>
                <td className="principal">{d.v.nom}</td>
                <td>{d.v.cotationOfficielle}</td>
                <td>{d.avant.cotationCalculee}</td>
                <td>{d.v.cotationCalculee}</td>
                <td className="num">{signe(d.delta, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!divergences.length && <p className="vide">{t('Rien à comparer.', 'Nothing to compare.')}</p>}
      <p className="param-aide" style={{ marginTop: 8 }}>
        {t(
          `Taux de réussite global : ${pourcent(courant.resume.tauxReussiteGlobal, 1)} — inchangé, c'est une propriété des données, pas du réglage.`,
          `Overall success rate: ${pourcent(courant.resume.tauxReussiteGlobal, 1)} — unchanged, it's a property of the data, not of the setting.`
        )}
      </p>
    </Carte>
  )
}
