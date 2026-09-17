import { useMemo, useState } from 'react'
import { ratingVersIndex } from '../../core/calibrage'
import { FORMULES } from '../../core/formulas/registry'
import { formaterIndex } from '../../core/cotations'
import type { LigneGrimpeur, Resultat } from '../../core/pipeline'
import { STYLES_BLOC } from '../../core/stylesBloc'
import { BasculeVue } from '../charts/base'
import { COULEURS_SERIES, Courbes, type Serie } from '../charts/Courbes'
import { Carte, LegendeCote, Tuile } from '../components/base'
import { Tableau, type Colonne } from '../components/Tableau'
import { dateCourte, nombre, pourcent } from '../format'
import { bilingue, useLangue } from '../langue'
import { echantillonner } from '../etat'

/** Au-dela, les teintes ne se distinguent plus de facon fiable. */
const MAX_SERIES = 4

export function VueGrimpeurs({
  resultat,
  resultats,
  simplifie = false,
}: {
  resultat: Resultat
  resultats: Map<string, Resultat>
  /** Vue visiteur : une seule colonne de cote (le melange), appelee simplement "Cote". */
  simplifie?: boolean
}) {
  const { langue, t } = useLangue()
  // Les colonnes de salle n'ont d'interet que si la communaute en frequente
  // plusieurs : sur une salle unique elles repetent la meme valeur partout.
  const plusieursSalles = resultat.resume.gyms.length > 1
  const [selection, setSelection] = useState<string[]>([])
  const [tableau, setTableau] = useState(false)

  const cotesParFormule = useMemo(() => {
    return FORMULES.map((f) => ({
      formule: f,
      parGrimpeur: new Map((resultats.get(f.id)?.grimpeurs ?? []).map((g) => [g.id, g])),
    })).filter((c) => c.parGrimpeur.size > 0)
  }, [resultats])

  // La ventilation par style vient toujours d'Elo bloc (cf. `elo-bloc.ts`),
  // quelle que soit la formule active a l'ecran : Glicko ne la calcule pas
  // (mise a jour bayesienne par periode, pas mouvement par mouvement, rien a
  // observer de la meme facon), et Melange n'est qu'une moyenne des deux
  // apres coup, sans trajectoire propre. La colonne affiche donc Melange —
  // la cote de reference partout ailleurs dans l'ecran — recalee du meme
  // ecart relatif qu'Elo a mesure pour le style : pas une vraie cote
  // Melange par style (Glicko n'y contribue pas), mais coherente avec la
  // cote a laquelle on se fie, plutot que de montrer Elo seul.
  const eloBloc = resultats.get('elo-bloc')
  const melangeBloc = resultats.get('melange')
  const eloParGrimpeur = useMemo(() => new Map((eloBloc?.grimpeurs ?? []).map((g) => [g.id, g])), [eloBloc])
  const melangeParGrimpeur = useMemo(() => new Map((melangeBloc?.grimpeurs ?? []).map((g) => [g.id, g])), [melangeBloc])
  const [styleSelectionne, setStyleSelectionne] = useState('')

  // Vue visiteur : une seule colonne, celle du melange, appelee simplement "Cote".
  const colonnesFormules = simplifie ? cotesParFormule.filter((c) => c.formule.id === 'melange') : cotesParFormule

  const classement = useMemo(
    () => [...resultat.grimpeurs].filter((g) => g.matchs > 0).sort((a, b) => b.rating - a.rating),
    [resultat]
  )

  // Selection par defaut : le meilleur, le median, et le plus assidu.
  const defaut = useMemo(() => {
    if (!classement.length) return []
    const ids = [classement[0].id, classement[Math.floor(classement.length / 2)]?.id]
    const assidu = [...classement].sort((a, b) => b.matchs - a.matchs)[0]
    if (assidu) ids.push(assidu.id)
    return [...new Set(ids.filter(Boolean))].slice(0, MAX_SERIES)
  }, [classement])

  const choisis = selection.length ? selection : defaut

  const series: Serie[] = useMemo(() => {
    const parGrimpeur = new Map<string, { t: number; v: number }[]>()
    for (const p of resultat.historique) {
      if (!choisis.includes(p.grimpeurId)) continue
      const liste = parGrimpeur.get(p.grimpeurId) ?? []
      liste.push({ t: p.t, v: ratingVersIndex(p.rating, resultat.calibrage) })
      parGrimpeur.set(p.grimpeurId, liste)
    }
    return choisis
      .map((id) => {
        const points = (parGrimpeur.get(id) ?? []).sort((a, b) => a.t - b.t)
        const g = resultat.grimpeurs.find((x) => x.id === id)
        return { cle: id, label: g?.nom ?? id, points: echantillonner(points, 70) }
      })
      .filter((s) => s.points.length > 1)
  }, [resultat, choisis])

  const basculer = (id: string) => {
    setSelection((s) => {
      const base = s.length ? s : defaut
      if (base.includes(id)) return base.filter((x) => x !== id)
      if (base.length >= MAX_SERIES) return [...base.slice(1), id]
      return [...base, id]
    })
  }

  const colonnes: Colonne<LigneGrimpeur>[] = [
    {
      cle: 'rang',
      titre: '#',
      num: true,
      aide: t('Rang au classement, par cote décroissante.', 'Rank in the leaderboard, by decreasing rating.'),
      valeur: (g) => classement.indexOf(g) + 1,
      tri: (g) => classement.indexOf(g),
    },
    {
      cle: 'nom',
      titre: t('Grimpeur', 'Climber'),
      principal: true,
      aide: t(
        'Une pastille de couleur signale les grimpeurs tracés dans la courbe de progression.',
        'A colored dot marks climbers plotted in the progression chart.'
      ),
      valeur: (g) => g.nom,
      rendu: (g) => {
        const i = choisis.indexOf(g.id)
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {i >= 0 && <i className="pastille" style={{ background: COULEURS_SERIES[i % COULEURS_SERIES.length] }} />}
            {g.nom}
          </span>
        )
      },
    },
    ...(plusieursSalles
      ? [
          { cle: 'gym', titre: t('Salle', 'Gym'), valeur: (g: LigneGrimpeur) => g.gymPrincipal },
          {
            cle: 'salles',
            titre: t('Salles', 'Gyms'),
            num: true,
            valeur: (g: LigneGrimpeur) => g.gyms.length,
            rendu: (g: LigneGrimpeur) =>
              g.gyms.length > 1 ? <span className="puce">{g.gyms.length}</span> : '1',
          },
        ]
      : []),
    {
      cle: 'niveau',
      titre: t('Niveau calculé', 'Calculated level'),
      aide: t(
        "La cotation que ce grimpeur envoie une fois sur deux : sa cote traduite en cotes V. La fraction entre parenthèses évite d'arrondir un V5,4 en V5 tout court.",
        "The grade this climber sends every other time: their rating translated into V grades. The fraction in parentheses avoids rounding a V5.4 down to a plain V5."
      ),
      valeur: (g) => g.cotationNiveau,
      tri: (g) => g.indexNiveau,
      rendu: (g) => formaterIndex(g.indexNiveau, langue),
    },
    ...colonnesFormules.map((c) => ({
      cle: `cote-${c.formule.id}`,
      titre: simplifie ? t('Cote', 'Rating') : bilingue(c.formule.labelCourt ?? c.formule.label, c.formule.labelCourtEn ?? c.formule.labelEn, langue),
      num: true,
      aide: simplifie
        ? t(
            "Cote du grimpeur. Divisez par 1000 pour la lire en cotes V : 5300 = V5,3. Un grimpeur coté 1000 points au-dessus d'un bloc l'envoie neuf fois sur dix.",
            "The climber's rating. Divide by 1000 to read it in V grades: 5300 = V5.3. A climber rated 1000 points above a boulder sends it nine times out of ten."
          )
        : t(
            `Cote du grimpeur selon la formule "${c.formule.label}". Divisez par 1000 pour la lire en cotes V : 5300 = V5,3. Un grimpeur coté 1000 points au-dessus d'un bloc l'envoie neuf fois sur dix.`,
            `The climber's rating according to the "${bilingue(c.formule.label, c.formule.labelEn, langue)}" formula. Divide by 1000 to read it in V grades: 5300 = V5.3. A climber rated 1000 points above a boulder sends it nine times out of ten.`
          ),
      valeur: (g: LigneGrimpeur) => c.parGrimpeur.get(g.id)?.rating ?? Number.NaN,
      rendu: (g: LigneGrimpeur) => {
        const ligne = c.parGrimpeur.get(g.id)
        if (!ligne || !Number.isFinite(ligne.rating)) return <span className="discret">—</span>
        const courante = c.formule.id === resultat.formuleId
        return <span style={{ fontWeight: courante ? 600 : undefined }}>{nombre(ligne.rating)}</span>
      },
    })),
    ...(eloBloc && melangeBloc
      ? [
          {
            cle: 'cote-style',
            titre: t('Cote par style', 'Rating by style'),
            titreRendu: () => (
              <select
                value={styleSelectionne}
                onChange={(e) => setStyleSelectionne(e.currentTarget.value)}
                onClick={(e) => e.stopPropagation()}
                // La table a `width: 100%` (styles.css) : sans min-width, le
                // moteur de mise en page auto des tableaux comprime cette
                // colonne pour faire tenir toutes les autres dans cette
                // largeur, au lieu de laisser le tableau deborder et
                // defiler horizontalement (`.table-enveloppe`) comme prevu —
                // illisible sur un ecran etroit (retour de Raphael sur
                // telephone). Un min-width force le tableau a deborder
                // plutot que d'ecraser ce select.
                style={{ font: 'inherit', fontWeight: 400, minWidth: 160 }}
              >
                <option value="">{t('Cote globale (Mélange)', 'Overall rating (Blend)')}</option>
                {STYLES_BLOC.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ),
            num: true,
            aide: t(
              "Cote Mélange (toujours cette formule, la référence utilisée partout ailleurs dans cet écran) pour le style choisi dans le menu déroulant. Le calcul par style n'existe que pour Elo bloc (Glicko ne s'y prête pas) : chaque style affiché ici est donc la cote Mélange globale du grimpeur, décalée du même écart qu'Elo a mesuré pour ce style-là — pas une cote Mélange indépendante, mais cohérente avec la cote affichée ailleurs. Tiret si le grimpeur n'a jamais affronté ce style.",
              "Blend rating (always this formula, the reference used everywhere else on this screen) for the style chosen in the dropdown. The per-style breakdown only exists for Elo boulder (Glicko doesn't lend itself to it): each style shown here is therefore the climber's overall Blend rating, shifted by the same gap Elo measured for that style — not an independent Blend rating, but consistent with the rating shown elsewhere. Dash if the climber never faced that style."
            ),
            valeur: (g: LigneGrimpeur) => {
              const ligneMelange = melangeParGrimpeur.get(g.id)
              if (!ligneMelange) return null
              if (!styleSelectionne) return ligneMelange.rating
              const ligneElo = eloParGrimpeur.get(g.id)
              const e = ligneElo?.stylesGrimpeur?.[styleSelectionne]
              if (!ligneElo || !e || e.matchs === 0) return null
              return ligneMelange.rating + (e.rating - ligneElo.rating)
            },
            rendu: (g: LigneGrimpeur) => {
              const ligneMelange = melangeParGrimpeur.get(g.id)
              if (!ligneMelange) return <span className="discret">—</span>
              if (!styleSelectionne) return <span>{nombre(ligneMelange.rating)}</span>
              const ligneElo = eloParGrimpeur.get(g.id)
              const e = ligneElo?.stylesGrimpeur?.[styleSelectionne]
              if (!ligneElo || !e || e.matchs === 0) return <span className="discret">—</span>
              return <span>{nombre(ligneMelange.rating + (e.rating - ligneElo.rating))}</span>
            },
          },
        ]
      : []),
    {
      cle: 'meilleure',
      titre: t('Plus dur envoyé', 'Hardest sent'),
      aide: t(
        "La cotation *affichée* la plus dure qu'il ait réellement envoyée. Elle dépasse souvent le niveau calculé, qui vise la cotation réussie une fois sur deux et non le record.",
        "The hardest *displayed* grade they actually sent. It often exceeds the calculated level, which targets the grade sent half the time, not their personal record."
      ),
      valeur: (g) => g.meilleureCotation,
    },
    {
      cle: 'matchs',
      titre: t('Duels utiles', 'Useful duels'),
      num: true,
      aide: t(
        "Nombre de blocs qu'il a affrontés et dont l'issue a compté. Les blocs largement hors de sa portée, dans un sens comme dans l'autre, n'y figurent pas.",
        "Number of boulders they faced whose outcome counted. Boulders far out of their reach either way are excluded."
      ),
      valeur: (g) => g.matchs,
    },
    {
      cle: 'taux',
      titre: t('Duels gagnés', 'Duels won'),
      num: true,
      aide: t(
        "Part de ces blocs qu'il a fini par envoyer. Un taux élevé signale surtout quelqu'un qui choisit des blocs à sa portée, pas nécessairement un bon grimpeur.",
        "Share of those boulders they eventually sent. A high rate mostly signals someone who picks boulders within reach, not necessarily a strong climber."
      ),
      valeur: (g) => g.tauxReussite,
      rendu: (g) => pourcent(g.tauxReussite),
    },
    {
      cle: 'suivi',
      titre: t('Courbe', 'Chart'),
      aide: t(
        `Ajoute ou retire ce grimpeur de la courbe de progression, ${MAX_SERIES} au maximum.`,
        `Adds or removes this climber from the progression chart, ${MAX_SERIES} at most.`
      ),
      valeur: (g) => (choisis.includes(g.id) ? 'oui' : 'non'),
      rendu: (g) => (
        <button className="bouton discret" aria-pressed={choisis.includes(g.id)} onClick={() => basculer(g.id)}>
          {choisis.includes(g.id) ? t('Retirer', 'Remove') : t('Suivre', 'Track')}
        </button>
      ),
    },
  ]

  const meilleur = classement[0]
  const median = classement[Math.floor(classement.length / 2)]

  return (
    <div className="large">
      <div className="grille tuiles">
        <Tuile
          etiquette={t('Grimpeurs classés', 'Ranked climbers')}
          valeur={nombre(classement.length)}
          note={t('au moins un affrontement', 'at least one duel')}
        />
        <Tuile
          etiquette={t('Meilleur niveau', 'Best level')}
          valeur={meilleur ? formaterIndex(meilleur.indexNiveau, langue) : '—'}
          note={meilleur?.nom}
        />
        <Tuile
          etiquette={t('Niveau médian', 'Median level')}
          valeur={median ? formaterIndex(median.indexNiveau, langue) : '—'}
          note={t('la moitié du groupe est au-dessus', 'half the group is above')}
        />
        <Tuile
          etiquette={t('Duels par grimpeur', 'Duels per climber')}
          valeur={nombre(classement.reduce((s, g) => s + g.matchs, 0) / (classement.length || 1))}
          note={t('en moyenne', 'on average')}
        />
      </div>
      <LegendeCote />

      <Carte
        titre={t('Classement', 'Leaderboard')}
        sousTitre={t(
          "Le niveau calculé est la cotation V que le grimpeur envoie une fois sur deux. Les cotes des deux formules sont affichées côte à côte ; celle en gras est la formule active.",
          "The calculated level is the V grade the climber sends half the time. Both formulas' ratings are shown side by side; the one in bold is the active formula."
        )}
      >
        <Tableau lignes={classement} colonnes={colonnes} cleLigne={(g) => g.id} triInitial={{ cle: 'rang', sens: 1 }} pageTaille={25} />
      </Carte>

      <Carte
        titre={t('Progression', 'Progression')}
        sousTitre={t(
          `Niveau estimé au fil du temps, ${MAX_SERIES} grimpeurs au maximum. Choisir qui suivre dans le tableau ci-dessus.`,
          `Estimated level over time, ${MAX_SERIES} climbers at most. Choose who to track in the table above.`
        )}
        actions={<BasculeVue tableau={tableau} setTableau={setTableau} />}
      >
        {tableau ? (
          <TableauProgression series={series} />
        ) : (
          <Courbes series={series} formatY={(v) => formaterIndex(v, langue).split(' ')[0]} />
        )}
      </Carte>
    </div>
  )
}

function TableauProgression({ series }: { series: Serie[] }) {
  const { langue, t } = useLangue()
  const lignes = series.flatMap((s) => s.points.map((p) => ({ nom: s.label, ...p })))
  return (
    <Tableau
      lignes={lignes}
      colonnes={[
        { cle: 'nom', titre: t('Grimpeur', 'Climber'), principal: true, valeur: (l) => l.nom },
        { cle: 'date', titre: t('Date', 'Date'), valeur: (l) => dateCourte(l.t), tri: (l) => l.t },
        { cle: 'niveau', titre: t('Niveau', 'Level'), valeur: (l) => formaterIndex(l.v, langue), tri: (l) => l.v },
      ]}
      cleLigne={(l) => `${l.nom}-${l.t}`}
      triInitial={{ cle: 'date', sens: 1 }}
      pageTaille={20}
      videMessage={t('Sélectionner au moins un grimpeur.', 'Select at least one climber.')}
    />
  )
}
