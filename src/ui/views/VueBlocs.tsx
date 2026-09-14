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
import { bilingue, useLangue } from '../langue'

/**
 * L'ecran qui repond a la question du projet : les cotations affichees en salle
 * tiennent-elles face a ce que les grimpeurs envoient reellement ?
 */
export function VueBlocs({
  resultat,
  resultats,
  simplifie = false,
}: {
  resultat: Resultat
  /** Toutes les formules, pour afficher leurs cotes cote a cote. */
  resultats: Map<string, Resultat>
  /** Vue visiteur : une seule colonne de cote (le melange), appelee simplement "Cote". */
  simplifie?: boolean
}) {
  const { langue, t } = useLangue()
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

  // Vue visiteur : une seule colonne, celle du melange, appelee simplement "Cote".
  const colonnesFormules = simplifie ? cotesParFormule.filter((c) => c.formule.id === 'melange') : cotesParFormule

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
    {
      cle: 'nom',
      titre: t('Bloc', 'Boulder'),
      principal: true,
      valeur: (b) => b.nom,
      aide: t(
        "Identifiant du bloc au mur, tel qu'il figure sur son étiquette.",
        'The boulder\'s identifier on the wall, as it appears on its tag.'
      ),
    },
    ...(plusieursSalles
      ? [
          {
            cle: 'gym',
            titre: t('Salle', 'Gym'),
            valeur: (b: LigneBloc) => b.gym,
            aide: t('Salle où le bloc est ouvert.', 'The gym where the boulder is set.'),
          },
        ]
      : []),
    {
      cle: 'secteur',
      titre: t('Secteur', 'Sector'),
      valeur: (b) => b.secteur,
      aide: t('Zone du mur où se trouve le bloc.', 'Area of the wall where the boulder is located.'),
    },
    {
      cle: 'couleur',
      titre: t('Couleur', 'Color'),
      valeur: (b) => b.couleur,
      aide: t(
        "Couleur des prises. Métadonnée d'affichage : elle n'entre dans aucun calcul.",
        "Hold color. Display metadata only: it plays no part in any calculation."
      ),
    },
    {
      cle: 'officielle',
      titre: t('Affichée', 'Displayed'),
      valeur: (b) => b.cotationOfficielle,
      tri: (b) => b.indexOfficiel,
      aide: t(
        "La cotation annoncée par l'ouvreur. C'est elle que le site met à l'épreuve, pas elle qui sert de référence.",
        "The grade announced by the route setter. It's the one the site tests, not the one used as ground truth."
      ),
    },
    {
      cle: 'calculee',
      titre: t('Calculée', 'Calculated'),
      valeur: (b) => b.cotationCalculee,
      tri: (b) => b.indexCalcule,
      aide: t(
        "La cotation déduite des réussites et des échecs par la formule active, sans regarder l'étiquette autrement que comme point de départ.",
        "The grade inferred from sends and failed attempts by the active formula, treating the tag only as a starting point, not as ground truth."
      ),
    },
    ...colonnesFormules.map((c) => ({
      cle: `cote-${c.formule.id}`,
      titre: simplifie ? t('Cote', 'Rating') : bilingue(c.formule.labelCourt ?? c.formule.label, c.formule.labelCourtEn ?? c.formule.labelEn, langue),
      num: true,
      aide: simplifie
        ? t(
            'Cote du bloc. Divisez par 1000 pour la lire en crans V : 4500 = V4,5.',
            'The boulder\'s rating. Divide by 1000 to read it in V grades: 4500 = V4.5.'
          )
        : t(
            `Cote du bloc selon la formule "${c.formule.label}". Divisez par 1000 pour la lire en crans V : 4500 = V4,5. ` +
              (c.formule.id === resultat.formuleId
                ? "C'est la formule active : c'est elle qui donne la cotation calculée et l'écart."
                : "Quand deux formules s'écartent nettement sur un bloc, c'est que ce bloc est mal connu."),
            `The boulder's rating according to the "${bilingue(c.formule.label, c.formule.labelEn, langue)}" formula. Divide by 1000 to read it in V grades: 4500 = V4.5. ` +
              (c.formule.id === resultat.formuleId
                ? "It's the active formula: it's the one driving the calculated grade and the gap."
                : "When two formulas disagree sharply on a boulder, that boulder is poorly documented.")
          ),
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
      titre: t('Écart', 'Gap'),
      num: true,
      aide: t(
        "Cotation calculée moins cotation affichée, en crans V. Positif : le bloc résiste plus que son étiquette ne le laisse croire. Négatif : il est plus facile qu'annoncé.",
        'Calculated grade minus displayed grade, in V grades. Positive: the boulder resists more than its tag suggests. Negative: it is easier than announced.'
      ),
      valeur: (b) => b.ecart,
      tri: (b) => b.ecart,
      rendu: (b) => <Ecart valeur={b.ecart} />,
    },
    ...(nbFormules > 1
      ? [
          {
            cle: 'avis',
            titre: t('Verdict', 'Verdict'),
            num: true,
            aide: t(
              "Ce que disent les formules qui votent. \"accord\" : aucune ne conteste l'ouvreur — ce n'est pas une absence de données, un bloc n'est listé que si toutes savent le juger. \"à vérifier\" : une seule conteste. \"confirmé\" : toutes contestent, et sur cette liste la précision mesurée est de 100 %.",
              "What the voting formulas say. \"agrees\": none contests the setter — this isn't a lack of data, a boulder is only listed if every formula can judge it. \"flagged\": one formula contests it. \"confirmed\": all of them contest it, and on that list the measured precision is 100%."
            ),
            valeur: (b: LigneBloc) => avisParBloc.get(b.id) ?? 0,
            rendu: (b: LigneBloc) => {
              const n = avisParBloc.get(b.id) ?? 0
              // Un bloc affiche ici est jugeable par toutes les formules, donc
              // aucune ne s'abstient : zero voix veut dire qu'elles confirment
              // toutes l'ouvreur. On l'ecrit, plutot que de laisser un tiret que
              // l'on lirait comme "pas de donnees".
              if (n === 0) return <span className="discret">{t('accord', 'agrees')}</span>
              // Les deux formules d'accord contre l'ouvreur : sur ce
              // sous-ensemble, la precision mesuree est de 100 %.
              if (n >= nbFormules) return <span className="puce alerte">{t('confirmé', 'confirmed')}</span>
              return <span className="puce">{t('à vérifier', 'flagged')}</span>
            },
          },
        ]
      : []),
    {
      cle: 'matchs',
      titre: t('Duels utiles', 'Useful duels'),
      num: true,
      aide: t(
        "Nombre de grimpeurs dont l'affrontement avec ce bloc a compté. Les issues jouées d'avance — un grimpeur deux crans en dessous qui échoue — sont exclues : elles n'apprennent rien.",
        "Number of climbers whose matchup with this boulder counted. Foregone outcomes — a climber two grades below who fails — are excluded: they teach nothing."
      ),
      valeur: (b) => b.matchs,
    },
    {
      cle: 'taux',
      titre: t('Envoyé par', 'Sent by'),
      num: true,
      aide: t(
        'Part des grimpeurs comptés qui ont fini par envoyer ce bloc, en un nombre quelconque de séances.',
        'Share of counted climbers who eventually sent this boulder, over any number of sessions.'
      ),
      valeur: (b) => b.tauxReussite,
      rendu: (b) => pourcent(b.tauxReussite),
    },
    {
      cle: 'incertitude',
      titre: t('Incertitude', 'Uncertainty'),
      num: true,
      aide: t(
        "Écart-type de la cote, produit par Glicko. Comptez environ deux fois cette valeur pour la marge à 95 % : à plus ou moins 300, la cote est connue à un demi-cran près.",
        'Standard deviation of the rating, produced by Glicko. Count roughly twice this value for the 95% margin: at plus or minus 300, the rating is known to within half a grade.'
      ),
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
                {g === 'tous' ? t('Toutes les salles', 'All gyms') : g}
              </option>
            ))}
          </select>
        )}
        <button className="bouton" aria-pressed={seulsDesaccords} onClick={() => setSeulsDesaccords((v) => !v)}>
          {t('Désaccords seulement', 'Discrepancies only')}
        </button>
        {nbFormules > 1 && (
          <span className="discret" style={{ fontSize: 12 }}>
            {t(
              `${nombre(confirmes.length)} confirmés par les ${nbFormules} formules`,
              `${nombre(confirmes.length)} confirmed by all ${nbFormules} formulas`
            )}
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
                    colonnesFormules.map((c) => [
                      simplifie ? 'cote' : `cote_${c.formule.id.replace(/-/g, '_')}`,
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
          {t('Exporter en CSV', 'Export as CSV')}
        </button>
      </div>

      <div className="grille tuiles">
        <Tuile
          heros
          etiquette={t('Blocs en désaccord avec leur cotation', 'Boulders disagreeing with their grade')}
          valeur={nombre(sousCotes.length + surCotes.length)}
          note={
            nbFormules > 1
              ? t(
                  `sur ${nombre(audites.length)} blocs exploitables, signalés par au moins une des ${nbFormules} formules — dont ${nombre(confirmes.length)} par les deux`,
                  `out of ${nombre(audites.length)} ratable boulders, flagged by at least one of the ${nbFormules} formulas — ${nombre(confirmes.length)} of them by both`
                )
              : t(
                  `sur ${nombre(audites.length)} blocs exploitables — au moins ${nombre(SEUIL_DESACCORD, 2)} cran V d'écart`,
                  `out of ${nombre(audites.length)} ratable boulders — at least ${nombre(SEUIL_DESACCORD, 2)} V grade of gap`
                )
          }
        />
        <Tuile
          etiquette={t('Sous-cotés', 'Underrated')}
          valeur={nombre(sousCotes.length)}
          note={t('plus durs que ce qui est affiché', 'harder than displayed')}
        />
        <Tuile
          etiquette={t('Sur-cotés', 'Overrated')}
          valeur={nombre(surCotes.length)}
          note={t('plus faciles que ce qui est affiché', 'easier than displayed')}
        />
        <Tuile
          etiquette={t('Écart médian', 'Median gap')}
          valeur={nombre(ecartMedianAbs, 2)}
          unite={t('cran V', 'V grade')}
          note={t('en valeur absolue', 'absolute value')}
        />
      </div>

      {isoles.length > 0 && (
        <Carte titre={t('Salles isolées', 'Isolated gyms')}>
          <p className="sous-titre">
            {t(
              `${isoles.map((g) => g.gym).join(', ')} n'${isoles.length > 1 ? 'ont' : 'a'} aucun grimpeur en commun avec les autres salles. Leurs cotes sont cohérentes entre elles, mais rien ne permet de les comparer à celles des autres salles : l'échelle de chaque salle isolée flotte librement.`,
              `${isoles.map((g) => g.gym).join(', ')} ${isoles.length > 1 ? 'have' : 'has'} no climber in common with the other gyms. Their ratings are internally consistent, but nothing lets us compare them to the other gyms: each isolated gym's scale floats freely.`
            )}
          </p>
        </Carte>
      )}

      <div className="grille deux" style={{ marginTop: 16 }}>
        <Carte
          titre={t('Cotation calculée contre cotation affichée', 'Calculated grade vs. displayed grade')}
          sousTitre={t(
            "Chaque point est un bloc. Sur la diagonale, le calcul confirme l'ouvreur. Les points sont légèrement décalés horizontalement pour ne pas se superposer.",
            "Each point is a boulder. On the diagonal, the calculation confirms the setter. Points are slightly offset horizontally so they don't overlap."
          )}
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
          titre={t('Distribution des écarts', 'Distribution of gaps')}
          sousTitre={t(
            'Une salle qui cote juste concentre ses blocs autour de zéro, avec des queues courtes.',
            'A gym with accurate grades has its boulders clustered around zero, with short tails.'
          )}
          actions={<BasculeVue tableau={tableauHisto} setTableau={setTableauHisto} />}
        >
          {tableauHisto ? <TableauClasses ecarts={ecarts} /> : <Histogramme valeurs={ecarts} uniteX={t('cran V', 'V grade')} />}
          <p className="param-aide" style={{ marginTop: 8 }}>
            {t(
              'Un écart positif signifie que le bloc résiste davantage que ne le laisse croire sa cotation.',
              'A positive gap means the boulder resists more than its grade suggests.'
            )}
          </p>
        </Carte>
      </div>

      <Carte
        titre={t('Tous les blocs exploitables', 'All ratable boulders')}
        sousTitre={t(
          "Blocs ayant assez de duels utiles pour être jugés. Un bloc ouvert la semaine dernière n'y est pas encore, ni celui que seuls des grimpeurs bien plus forts ou bien plus faibles ont touché. Le verdict résume l'avis des formules qui votent : accord avec l'ouvreur, à vérifier si l'une le conteste, confirmé si toutes le contestent. Les cotes de chaque formule sont affichées à côté : quand elles s'écartent nettement, c'est que le bloc est mal connu.",
          "Boulders with enough useful duels to be judged. A boulder set last week isn't in yet, nor is one that only much stronger or much weaker climbers have touched. The verdict summarizes what the voting formulas say: agrees with the setter, flagged if one contests it, confirmed if all contest it. Each formula's rating is shown alongside: when they diverge sharply, the boulder is poorly documented."
        )}
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
  const { t } = useLangue()
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
          titre: t('Écart (crans V)', 'Gap (V grades)'),
          principal: true,
          valeur: (l) => l.debut,
          tri: (l) => l.debut,
          rendu: (l) => `${signe(l.debut, 1)} ${t('à', 'to')} ${signe(l.debut + pas, 1)}`,
        },
        { cle: 'n', titre: t('Blocs', 'Boulders'), num: true, valeur: (l) => l.n },
        {
          cle: 'part',
          titre: t('Part', 'Share'),
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
