import { useMemo, useState } from 'react'
import { versCsv } from '../../core/loaders/csv'
import { SEUIL_DESACCORD, type LigneBloc, type Resultat } from '../../core/pipeline'
import { BasculeVue } from '../charts/base'
import { Histogramme } from '../charts/Histogramme'
import { Nuage } from '../charts/Nuage'
import { Carte, Tuile } from '../components/base'
import { Tableau, type Colonne } from '../components/Tableau'
import { nombre, pourcent, signe, telecharger } from '../format'

/**
 * L'ecran qui repond a la question du projet : les cotations affichees en salle
 * tiennent-elles face a ce que les grimpeurs envoient reellement ?
 */
export function VueBlocs({ resultat }: { resultat: Resultat }) {
  const [gym, setGym] = useState('tous')
  const [seulsDesaccords, setSeulsDesaccords] = useState(false)
  const [tableauNuage, setTableauNuage] = useState(false)
  const [tableauHisto, setTableauHisto] = useState(false)

  const plusieursSalles = resultat.resume.gyms.length > 1
  const gyms = useMemo(
    () => ['tous', ...resultat.resume.gyms.map((g) => g.gym)],
    [resultat]
  )

  const audites = useMemo(
    () => resultat.blocs.filter((b) => b.fiable && (gym === 'tous' || b.gym === gym)),
    [resultat, gym]
  )
  const affiches = seulsDesaccords ? audites.filter((b) => Math.abs(b.ecart) >= SEUIL_DESACCORD) : audites

  const sousCotes = audites.filter((b) => b.ecart >= SEUIL_DESACCORD)
  const surCotes = audites.filter((b) => b.ecart <= -SEUIL_DESACCORD)
  const ecarts = audites.map((b) => b.ecart)
  const ecartMedianAbs = mediane(ecarts.map(Math.abs))

  const isoles = plusieursSalles ? resultat.resume.gyms.filter((g) => g.ponts === 0) : []

  const colonnes: Colonne<LigneBloc>[] = [
    { cle: 'nom', titre: 'Bloc', principal: true, valeur: (b) => b.nom },
    ...(plusieursSalles ? [{ cle: 'gym', titre: 'Salle', valeur: (b: LigneBloc) => b.gym }] : []),
    { cle: 'secteur', titre: 'Secteur', valeur: (b) => b.secteur },
    { cle: 'couleur', titre: 'Couleur', valeur: (b) => b.couleur },
    { cle: 'officielle', titre: 'Affichee', valeur: (b) => b.cotationOfficielle, tri: (b) => b.indexOfficiel },
    { cle: 'calculee', titre: 'Calculee', valeur: (b) => b.cotationCalculee, tri: (b) => b.indexCalcule },
    {
      cle: 'cote',
      titre: 'Cote Elo',
      num: true,
      valeur: (b) => b.rating,
      rendu: (b) => nombre(b.rating),
    },
    {
      cle: 'ecart',
      titre: 'Ecart',
      num: true,
      valeur: (b) => b.ecart,
      tri: (b) => b.ecart,
      rendu: (b) => <Ecart valeur={b.ecart} />,
    },
    { cle: 'matchs', titre: 'Duels', num: true, valeur: (b) => b.matchs },
    { cle: 'taux', titre: 'Envoye par', num: true, valeur: (b) => b.tauxReussite, rendu: (b) => pourcent(b.tauxReussite) },
    {
      cle: 'incertitude',
      titre: 'Incertitude',
      num: true,
      valeur: (b) => b.incertitude ?? Number.NaN,
      rendu: (b) => (b.incertitude === undefined ? <span className="discret">—</span> : `± ${nombre(b.incertitude)}`),
    },
  ]

  return (
    <div className="large">
      <div className="barre-outils">
        {plusieursSalles && (
          <select value={gym} onChange={(e) => setGym(e.currentTarget.value)} style={{ width: 240 }}>
            {gyms.map((g) => (
              <option key={g} value={g}>
                {g === 'tous' ? 'Toutes les salles' : g}
              </option>
            ))}
          </select>
        )}
        <button className="bouton" aria-pressed={seulsDesaccords} onClick={() => setSeulsDesaccords((v) => !v)}>
          Desaccords seulement
        </button>
        <span className="espace" />
        <button
          className="bouton"
          onClick={() =>
            telecharger(
              'cotes-calculees.csv',
              versCsv(
                affiches.map((b) => ({
                  id: b.id,
                  nom: b.nom,
                  gym: b.gym,
                  secteur: b.secteur,
                  couleur: b.couleur,
                  cotation_affichee: b.cotationOfficielle,
                  cotation_calculee: b.cotationCalculee,
                  cote_elo: Math.round(b.rating),
                  ecart_crans: Number(b.ecart.toFixed(2)),
                  duels: b.matchs,
                  taux_reussite: Number(b.tauxReussite.toFixed(3)),
                }))
              )
            )
          }
        >
          Exporter en CSV
        </button>
      </div>

      <div className="grille tuiles">
        <Tuile
          heros
          etiquette="Blocs en desaccord avec leur cotation"
          valeur={nombre(sousCotes.length + surCotes.length)}
          note={`sur ${nombre(audites.length)} blocs exploitables — au moins ${nombre(SEUIL_DESACCORD, 2)} cran V d'ecart`}
        />
        <Tuile etiquette="Sous-cotes" valeur={nombre(sousCotes.length)} note="plus durs que ce qui est affiche" />
        <Tuile etiquette="Sur-cotes" valeur={nombre(surCotes.length)} note="plus faciles que ce qui est affiche" />
        <Tuile etiquette="Ecart median" valeur={nombre(ecartMedianAbs, 2)} unite="cran V" note="en valeur absolue" />
      </div>

      {isoles.length > 0 && (
        <Carte titre="Salles isolees">
          <p className="sous-titre">
            {isoles.map((g) => g.gym).join(', ')} n'{isoles.length > 1 ? 'ont' : 'a'} aucun grimpeur en commun avec les
            autres salles. Leurs cotes sont coherentes entre elles, mais rien ne permet de les comparer a celles des
            autres salles : l'echelle de chaque salle isolee flotte librement.
          </p>
        </Carte>
      )}

      <div className="grille deux" style={{ marginTop: 16 }}>
        <Carte
          titre="Cotation calculee contre cotation affichee"
          sousTitre="Chaque point est un bloc. Sur la diagonale, le calcul confirme l'ouvreur. Les points sont legerement decales horizontalement pour ne pas se superposer."
          actions={<BasculeVue tableau={tableauNuage} setTableau={setTableauNuage} />}
        >
          {tableauNuage ? (
            <Tableau
              lignes={affiches}
              colonnes={colonnes.filter((c) => ['nom', 'gym', 'officielle', 'calculee', 'cote', 'ecart'].includes(c.cle))}
              cleLigne={(b) => b.id}
              triInitial={{ cle: 'ecart', sens: -1 }}
              pageTaille={12}
            />
          ) : (
            <Nuage
              points={affiches.map((b) => ({
                cle: b.id,
                nom: b.nom,
                lieu: plusieursSalles ? `${b.gym} · ${b.secteur} · ${b.couleur}` : `${b.secteur} · ${b.couleur}`,
                x: b.indexOfficiel,
                y: b.indexCalcule,
                ecart: b.ecart,
                matchs: b.matchs,
                cotationOfficielle: b.cotationOfficielle,
                cotationCalculee: b.cotationCalculee,
              }))}
            />
          )}
        </Carte>

        <Carte
          titre="Distribution des ecarts"
          sousTitre="Une salle qui cote juste concentre ses blocs autour de zero, avec des queues courtes."
          actions={<BasculeVue tableau={tableauHisto} setTableau={setTableauHisto} />}
        >
          {tableauHisto ? <TableauClasses ecarts={ecarts} /> : <Histogramme valeurs={ecarts} uniteX="cran V" />}
          <p className="param-aide" style={{ marginTop: 8 }}>
            Un ecart positif signifie que le bloc resiste davantage que ne le laisse croire sa cotation.
          </p>
        </Carte>
      </div>

      <Carte
        titre="Tous les blocs exploitables"
        sousTitre="Blocs ayant assez de duels pour etre juges — un bloc ouvert la semaine derniere n'y est pas encore. Seuil regle dans l'ecran Formules."
      >
        <Tableau lignes={affiches} colonnes={colonnes} cleLigne={(b) => b.id} triInitial={{ cle: 'ecart', sens: -1 }} />
      </Carte>
    </div>
  )
}

function Ecart({ valeur }: { valeur: number }) {
  const largeur = Math.min(100, (Math.abs(valeur) / 3) * 100)
  const couleur = valeur >= 0 ? 'var(--div-chaud)' : 'var(--div-froid)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}>
      <span style={{ width: 42, display: 'inline-block' }}>{signe(valeur)}</span>
      <span style={{ width: 46, display: 'inline-block', position: 'relative', height: 7 }}>
        <span
          className="barre-ecart"
          style={{
            width: `${largeur / 2}%`,
            background: couleur,
            position: 'absolute',
            left: valeur >= 0 ? '50%' : undefined,
            right: valeur < 0 ? '50%' : undefined,
          }}
        />
      </span>
    </span>
  )
}

function TableauClasses({ ecarts }: { ecarts: number[] }) {
  const pas = 0.5
  const classes = new Map<number, number>()
  for (const e of ecarts) {
    const c = Math.floor(e / pas) * pas
    classes.set(c, (classes.get(c) ?? 0) + 1)
  }
  const lignes = [...classes].sort((a, b) => a[0] - b[0]).map(([debut, n]) => ({ debut, n }))
  return (
    <Tableau
      lignes={lignes}
      colonnes={[
        {
          cle: 'classe',
          titre: 'Ecart (crans V)',
          principal: true,
          valeur: (l) => l.debut,
          tri: (l) => l.debut,
          rendu: (l) => `${signe(l.debut, 1)} a ${signe(l.debut + pas, 1)}`,
        },
        { cle: 'n', titre: 'Blocs', num: true, valeur: (l) => l.n },
        {
          cle: 'part',
          titre: 'Part',
          num: true,
          valeur: (l) => l.n / ecarts.length,
          rendu: (l) => pourcent(l.n / ecarts.length, 1),
        },
      ]}
      cleLigne={(l) => String(l.debut)}
      triInitial={{ cle: 'classe', sens: 1 }}
      pageTaille={20}
    />
  )
}

function mediane(v: number[]): number {
  if (!v.length) return 0
  const t = [...v].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}
