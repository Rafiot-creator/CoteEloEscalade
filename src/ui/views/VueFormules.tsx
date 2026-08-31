import { PARAMS_CALIBRAGE, pointsParCran } from '../../core/calibrage'
import type { Diagnostic } from '../../core/formulas/types'
import type { Resultat } from '../../core/pipeline'
import { MiniCourbe } from '../charts/Courbes'
import { Carte, PanneauParams, Tuile } from '../components/base'
import { nombre, pourcent, signe } from '../format'
import type { Atelier } from '../etat'

/**
 * L'atelier de reglage.
 *
 * Toute la colonne de gauche est generee a partir des declarations de la
 * formule choisie : cet ecran ne connait aucune formule en particulier.
 */
export function VueFormules({ atelier }: { atelier: Atelier }) {
  const { formule, formules, params, paramsCalibrage, resultat, reference } = atelier
  if (!resultat) return null

  return (
    <div className="large">
      <div className="grille atelier">
        <div>
          <Carte titre="Formule" sousTitre={formule.description}>
            <select value={formule.id} onChange={(e) => atelier.choisirFormule(e.currentTarget.value)}>
              {formules.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 12 }}>
              <PanneauParams specs={formule.params} valeurs={params} onChange={atelier.setParam} />
            </div>
          </Carte>

          <Carte
            titre="Calibrage"
            sousTitre="Conversion de la cote Elo, unite interne au modele, vers l'echelle V."
          >
            <PanneauParams specs={PARAMS_CALIBRAGE} valeurs={paramsCalibrage} onChange={atelier.setParamCalibrage} />
          </Carte>

          <Carte>
            <div className="barre-outils" style={{ margin: 0 }}>
              <button className="bouton" onClick={atelier.reinitialiser}>
                Valeurs par defaut
              </button>
              <button className="bouton" onClick={atelier.memoriser}>
                Memoriser ce reglage
              </button>
              {reference && (
                <button className="bouton discret" onClick={atelier.oublier}>
                  Oublier
                </button>
              )}
            </div>
          </Carte>
        </div>

        <div>
          <Carte
            titre="Qualite du calcul"
            sousTitre={`${resultat.formuleLabel} — ${nombre(resultat.dureeMs)} ms sur ${nombre(resultat.resume.duels)} affrontements.`}
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
            titre="Convergence"
            sousTitre="Correction moyenne appliquee a chaque passe. La courbe doit s'aplatir : si elle ne descend pas, augmenter le nombre de passes."
          >
            <MiniCourbe valeurs={resultat.convergence} />
            <div className="legende" style={{ marginTop: 4 }}>
              <span className="discret">
                passe 1 : {nombre(resultat.convergence[0] ?? 0, 2)} pts · derniere passe :{' '}
                {nombre(resultat.convergence[resultat.convergence.length - 1] ?? 0, 2)} pts
              </span>
            </div>
          </Carte>

          <Carte titre="Echelle obtenue" sousTitre="Ce que vaut un cran V, dans l'unite du modele.">
            <div className="grille tuiles">
              <Tuile
                etiquette="Points par cran V"
                valeur={nombre(pointsParCran(resultat.calibrage))}
                unite="pts"
                note={resultat.calibrage.mode === 'auto' ? 'deduit des donnees' : 'fixe manuellement'}
              />
              {resultat.calibrage.mode === 'auto' ? (
                <Tuile
                  etiquette="Ajustement (r²)"
                  valeur={nombre(resultat.calibrage.r2, 2)}
                  note={`regression sur ${nombre(resultat.calibrage.nBlocs)} blocs`}
                />
              ) : (
                <Tuile
                  etiquette="Methode"
                  valeur="Echelle fixe"
                  note="Passer en mode regression pour voir combien de points separent reellement deux crans dans vos donnees."
                />
              )}
              <Tuile
                etiquette="Blocs exploitables"
                valeur={nombre(resultat.resume.blocsAudites)}
                note={`sur ${nombre(resultat.resume.blocsTotal)}`}
              />
              <Tuile
                etiquette="Ecart median"
                valeur={nombre(resultat.resume.ecartMedianAbs, 2)}
                unite="cran V"
                note="calcul contre cotation affichee"
              />
            </div>
            {resultat.calibrage.avertissement && (
              <p className="param-aide" style={{ color: 'var(--critique)', marginTop: 10 }}>
                {resultat.calibrage.avertissement}
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
  const delta = precedent ? d.valeur - precedent.valeur : null
  const mieux = delta === null || Math.abs(delta) < 1e-9 ? null : d.basMieux ? delta < 0 : delta > 0
  return (
    <Tuile
      etiquette={d.label}
      valeur={nombre(d.valeur, d.valeur < 10 ? 3 : 0)}
      unite={d.unite}
      note={
        delta === null ? (
          d.aide
        ) : (
          <span style={{ color: mieux === null ? undefined : mieux ? 'var(--bon)' : 'var(--critique)' }}>
            {signe(delta, 3)} vs reglage memorise
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
      titre="Comparaison avec le reglage memorise"
      sousTitre={`${reference.etiquette} → ${courant.formuleLabel}. Blocs dont la cotation calculee bouge le plus.`}
    >
      <div className="grille tuiles" style={{ marginBottom: 12 }}>
        <Tuile etiquette="Deplacement moyen" valeur={nombre(deplacementMoyen, 2)} unite="cran V" />
        <Tuile
          etiquette="Blocs deplaces d'un cran ou plus"
          valeur={nombre(divergences.filter((d) => Math.abs(d.delta) >= 1).length)}
          note={`sur ${nombre(divergences.length)}`}
        />
        <Tuile
          etiquette="Desaccords avec l'ouvreur"
          valeur={nombre(courant.resume.desaccords)}
          note={`etait ${nombre(reference.resultat.resume.desaccords)}`}
        />
      </div>
      <div className="table-enveloppe">
        <table className="donnees">
          <thead>
            <tr>
              <th>Bloc</th>
              <th>Affichee</th>
              <th>Memorise</th>
              <th>Courant</th>
              <th className="num">Deplacement</th>
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
      {!divergences.length && <p className="vide">Rien a comparer.</p>}
      <p className="param-aide" style={{ marginTop: 8 }}>
        Taux de reussite global : {pourcent(courant.resume.tauxReussiteGlobal, 1)} — inchange, c'est une propriete des
        donnees, pas du reglage.
      </p>
    </Carte>
  )
}
