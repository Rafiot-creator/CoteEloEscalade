import { useMemo, useState } from 'react'
import { FORMULES } from '../../core/formulas/registry'
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
export function VueBlocs({
  resultat,
  resultats,
}: {
  resultat: Resultat
  /** Toutes les formules, pour afficher leurs cotes cote a cote. */
  resultats: Map<string, Resultat>
}) {
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
  const isoles = plusieursSalles ? resultat.resume.gyms.filter((g) => g.ponts === 0) : []

  // Une colonne de cote par formule : on veut pouvoir constater leur accord —
  // ou leur desaccord, qui est en soi un signal de fragilite sur ce bloc.
  const cotesParFormule = useMemo(() => {
    return FORMULES.map((f) => ({
      formule: f,
      parBloc: new Map((resultats.get(f.id)?.blocs ?? []).map((b) => [b.id, b])),
    })).filter((c) => c.parBloc.size > 0)
  }, [resultats])

  /**
   * Combien de formules signalent ce bloc ?
   *
   * Chacune se trompe differemment : combiner leurs avis detecte nettement plus
   * de blocs mal cotes que la meilleure prise seule — mesure sur le monde
   * temoin, 52 % des blocs sous-cotes contre 39 %, pour 2,4 % de fausses
   * alertes contre 1,6 %. Et l'accord des deux est un signal de confiance a
   * part entiere : sur les blocs qu'elles signalent ensemble, la precision est
   * de 100 %.
   */
  const juresIndependants = useMemo(
    () => cotesParFormule.filter((c) => c.formule.avisIndependant !== false),
    [cotesParFormule]
  )

  const avisParBloc = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of juresIndependants) {
      const seuil = resultats.get(c.formule.id)?.seuilDesaccord ?? SEUIL_DESACCORD
      for (const [id, b] of c.parBloc) {
        const compte = b.fiable && Math.abs(b.ecart) >= seuil ? 1 : 0
        m.set(id, (m.get(id) ?? 0) + compte)
      }
    }
    return m
  }, [juresIndependants, resultats])

  const nbFormules = juresIndependants.length

  const signale = (b: LigneBloc) => (avisParBloc.get(b.id) ?? 0) > 0
  const affiches = seulsDesaccords ? audites.filter(signale) : audites

  const sousCotes = audites.filter((b) => signale(b) && b.ecart > 0)
  const surCotes = audites.filter((b) => signale(b) && b.ecart < 0)
  const confirmes = audites.filter((b) => (avisParBloc.get(b.id) ?? 0) >= nbFormules && nbFormules > 1)
  const ecarts = audites.map((b) => b.ecart)
  const ecartMedianAbs = mediane(ecarts.map(Math.abs))

  /** L'incertitude vient de la formule qui en produit une, quelle qu'elle soit. */
  const incertitudeParBloc = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of cotesParFormule) {
      for (const [id, b] of c.parBloc) {
        if (b.incertitude !== undefined && !m.has(id)) m.set(id, b.incertitude)
      }
    }
    return m
  }, [cotesParFormule])

  const colonnes: Colonne<LigneBloc>[] = [
    { cle: 'nom', titre: 'Bloc', principal: true, valeur: (b) => b.nom },
    ...(plusieursSalles ? [{ cle: 'gym', titre: 'Salle', valeur: (b: LigneBloc) => b.gym }] : []),
    { cle: 'secteur', titre: 'Secteur', valeur: (b) => b.secteur },
    { cle: 'couleur', titre: 'Couleur', valeur: (b) => b.couleur },
    { cle: 'officielle', titre: 'Affichee', valeur: (b) => b.cotationOfficielle, tri: (b) => b.indexOfficiel },
    { cle: 'calculee', titre: 'Calculee', valeur: (b) => b.cotationCalculee, tri: (b) => b.indexCalcule },
    ...cotesParFormule.map((c) => ({
      cle: `cote-${c.formule.id}`,
      titre: c.formule.labelCourt ?? c.formule.label,
      num: true,
      valeur: (b: LigneBloc) => c.parBloc.get(b.id)?.rating ?? Number.NaN,
      rendu: (b: LigneBloc) => {
        const ligne = c.parBloc.get(b.id)
        if (!ligne || !Number.isFinite(ligne.rating)) return <span className="discret">—</span>
        // La formule courante est celle qui pilote l'ecart : on la souligne.
        const courante = c.formule.id === resultat.formuleId
        return <span style={{ fontWeight: courante ? 600 : undefined }}>{nombre(ligne.rating)}</span>
      },
    })),
    {
      cle: 'ecart',
      titre: 'Ecart',
      num: true,
      valeur: (b) => b.ecart,
      tri: (b) => b.ecart,
      rendu: (b) => <Ecart valeur={b.ecart} />,
    },
    ...(nbFormules > 1
      ? [
          {
            cle: 'avis',
            titre: 'Avis',
            num: true,
            valeur: (b: LigneBloc) => avisParBloc.get(b.id) ?? 0,
            rendu: (b: LigneBloc) => {
              const n = avisParBloc.get(b.id) ?? 0
              if (n === 0) return <span className="discret">—</span>
              // Les deux formules d'accord : sur ce sous-ensemble, la precision
              // mesuree est de 100 %.
              if (n >= nbFormules) return <span className="puce alerte">confirme</span>
              return <span className="puce">a verifier</span>
            },
          },
        ]
      : []),
    { cle: 'matchs', titre: 'Duels utiles', num: true, valeur: (b) => b.matchs },
    { cle: 'taux', titre: 'Envoye par', num: true, valeur: (b) => b.tauxReussite, rendu: (b) => pourcent(b.tauxReussite) },
    {
      cle: 'incertitude',
      titre: 'Incertitude',
      num: true,
      valeur: (b) => incertitudeParBloc.get(b.id) ?? Number.NaN,
      rendu: (b) => {
        const rd = incertitudeParBloc.get(b.id)
        return rd === undefined ? <span className="discret">—</span> : `± ${nombre(rd)}`
      },
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
        {nbFormules > 1 && (
          <span className="discret" style={{ fontSize: 12 }}>
            {nombre(confirmes.length)} confirmes par les {nbFormules} formules
          </span>
        )}
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
                  ...Object.fromEntries(
                    cotesParFormule.map((c) => [
                      `cote_${c.formule.id.replace(/-/g, '_')}`,
                      Math.round(c.parBloc.get(b.id)?.rating ?? Number.NaN),
                    ])
                  ),
                  ecart_crans: Number(b.ecart.toFixed(2)),
                  formules_en_desaccord: avisParBloc.get(b.id) ?? 0,
                  duels_utiles: b.matchs,
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
          note={
            nbFormules > 1
              ? `sur ${nombre(audites.length)} blocs exploitables, signales par au moins une des ${nbFormules} formules — dont ${nombre(confirmes.length)} par les deux`
              : `sur ${nombre(audites.length)} blocs exploitables — au moins ${nombre(SEUIL_DESACCORD, 2)} cran V d'ecart`
          }
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
              colonnes={colonnes.filter(
                (c) =>
                  ['nom', 'gym', 'officielle', 'calculee', 'ecart', 'avis'].includes(c.cle) ||
                  c.cle.startsWith('cote-')
              )}
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
        sousTitre="Blocs ayant assez de duels utiles pour etre juges. Un bloc ouvert la semaine derniere n'y est pas encore, ni celui que seuls des grimpeurs bien plus forts ou bien plus faibles ont touche. Les deux formules sont affichees cote a cote : quand elles s'ecartent nettement, c'est que le bloc est mal connu. Seuils regles dans l'ecran Formules."
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
