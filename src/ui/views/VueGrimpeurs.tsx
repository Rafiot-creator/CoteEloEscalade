import { useMemo, useState } from 'react'
import { ratingVersIndex } from '../../core/calibrage'
import { DUELS_PROVISOIRES } from '../../core/formulas/lib'
import { formaterIndex } from '../../core/cotations'
import type { LigneGrimpeur, Resultat } from '../../core/pipeline'
import { STYLES_BLOC } from '../../core/stylesBloc'
import { BasculeVue } from '../charts/base'
import { COULEURS_SERIES, Courbes, type Serie } from '../charts/Courbes'
import { Histogramme } from '../charts/Histogramme'
import { Carte, LegendeCote, Tuile } from '../components/base'
import { Tableau, type Colonne } from '../components/Tableau'
import { dateCourte, nombre, pourcent } from '../format'
import { useLangue } from '../langue'
import { echantillonner } from '../etat'
import { useChoixMemorise, useTriMemorise } from '../memoire'

/** Au-dela, les teintes ne se distinguent plus de facon fiable. */
const MAX_SERIES = 4

export function VueGrimpeurs({
  resultat,
  resultats,
  simplifie = false,
  moi,
  masque = false,
  definirMasque,
}: {
  resultat: Resultat
  resultats: Map<string, Resultat>
  /** Id du grimpeur du compte connecte : sa ligne est mise en evidence. */
  moi?: string | null
  /**
   * « Je ne souhaite pas apparaitre dans le classement », pour le compte
   * connecte (absent sans compte). Renvoie un message d'erreur, ou null.
   */
  masque?: boolean
  definirMasque?: (masque: boolean) => Promise<string | null>
  /** Vue visiteur : une seule colonne de cote (le melange), appelee simplement "Cote". */
  simplifie?: boolean
}) {
  const { langue, t } = useLangue()
  // Les colonnes de salle n'ont d'interet que si la communaute en frequente
  // plusieurs : sur une salle unique elles repetent la meme valeur partout.
  const plusieursSalles = resultat.resume.gyms.length > 1
  const [selection, setSelection] = useState<string[]>([])
  const [tableau, setTableau] = useState(false)
  // Case cochee/decochee en attente de la base : affichee tout de suite.
  const [masqueEnCours, setMasqueEnCours] = useState<boolean | null>(null)
  const [erreurMasque, setErreurMasque] = useState<string | null>(null)
  const masqueAffiche = masqueEnCours ?? masque
  const basculerMasque = async (m: boolean) => {
    if (!definirMasque) return
    setMasqueEnCours(m)
    setErreurMasque(null)
    const erreur = await definirMasque(m)
    setMasqueEnCours(null)
    if (erreur) setErreurMasque(erreur)
  }

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
  // Style choisi et tri retenus dans ce navigateur (voir `memoire.ts`).
  const [styleSelectionne, setStyleSelectionne] = useChoixMemorise<string>('cee-style-grimpeurs', ['', ...STYLES_BLOC], '')
  // Tri du tableau Classement, pilote depuis ici pour que choisir un style
  // dans le menu deroulant de la colonne "Cote par style" retrie aussitot le
  // classement sur cette colonne, sans empecher un clic manuel sur un autre
  // en-tete (cf. `onTri` sur `Tableau`).
  const [triClassement, setTriClassement] = useTriMemorise('grimpeurs', { cle: 'rang', sens: 1 })

  /**
   * Duels/reussites d'un grimpeur pour le style choisi, pour les colonnes a
   * droite de "Cote par style" (Plus dur envoye, Duels utiles, Duels gagnes) :
   * les faire suivre le style choisi plutot que de toujours montrer les
   * totaux tous styles confondus, incoherent une fois qu'on regarde une seule
   * colonne "par style". Meme source qu'Elo bloc pour la colonne de cote
   * elle-meme (`stylesGrimpeur`), absente si aucun style n'est choisi.
   */
  const enStyle = (g: LigneGrimpeur) =>
    styleSelectionne ? eloParGrimpeur.get(g.id)?.stylesGrimpeur?.[styleSelectionne] : undefined

  // Les grimpeurs en periode d'essai (moins de dix blocs tentes, cf.
  // `LigneGrimpeur.provisoire`) n'apparaissent nulle part dans le classement
  // ni dans les graphiques : leur cote n'est pas encore stable. Seul le
  // compte concerne voit sa position, marquee provisoire (tuile plus bas).
  // Ceux qui ont demande a ne pas y apparaitre (`masqueClassement`) non plus :
  // le compte concerne voit ses cotes sur une ligne a part, au-dessus du tableau.
  const classement = useMemo(
    () =>
      [...resultat.grimpeurs]
        .filter((g) => g.matchs > 0 && !g.provisoire && !g.masqueClassement)
        .sort((a, b) => b.rating - a.rating),
    [resultat]
  )
  const moiHorsClassement = moi
    ? resultat.grimpeurs.find((g) => g.id === moi && g.masqueClassement && g.matchs > 0 && !g.provisoire)
    : undefined
  const enEssai = useMemo(() => resultat.grimpeurs.filter((g) => g.matchs > 0 && g.provisoire).length, [resultat])
  const moiProvisoire = moi ? resultat.grimpeurs.find((g) => g.id === moi && g.provisoire) : undefined

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
      // Ligne a part du compte hors classement : pas de rang.
      rendu: (g) => (classement.includes(g) ? classement.indexOf(g) + 1 : <span className="discret">—</span>),
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
    // Seule colonne de cote, dans toutes les vues (choix de Raphael,
    // 2026-11-01) : la cote Melange, appelee « Cote calculee », ou celle d'un
    // style choisi dans le menu de l'en-tete. Comparer les formules entre
    // elles reste possible dans l'ecran Formules.
    ...(eloBloc && melangeBloc
      ? [
          {
            cle: 'cote-style',
            titre: t('Cote calculée', 'Calculated rating'),
            titreRendu: () => (
              <select
                value={styleSelectionne}
                onChange={(e) => {
                  setStyleSelectionne(e.currentTarget.value)
                  setTriClassement({ cle: 'cote-style', sens: -1 })
                }}
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
                <option value="">{t('Cote calculée', 'Calculated rating')}</option>
                {STYLES_BLOC.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ),
            num: true,
            aide: t(
              "Cote du grimpeur, calculée à partir de ses réussites et de ses échecs. Divisez par 1000 pour la lire en cotes V : 5300 = V5,3. Un grimpeur coté 1000 points au-dessus d'un bloc l'envoie neuf fois sur dix. Choisir un style dans le menu montre sa cote dans ce style seulement (tiret s'il ne l'a jamais affronté).",
              "The climber's rating, calculated from their sends and failed attempts. Divide by 1000 to read it in V grades: 5300 = V5.3. A climber rated 1000 points above a boulder sends it nine times out of ten. Picking a style in the menu shows their rating in that style only (dash if they never faced it)."
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
      titre: styleSelectionne ? t(`Plus dur envoyé (${styleSelectionne})`, `Hardest sent (${styleSelectionne})`) : t('Plus dur envoyé', 'Hardest sent'),
      aide: styleSelectionne
        ? t(
            `La cotation *affichée* la plus dure qu'il ait réellement envoyée dans le style "${styleSelectionne}" — tiret s'il ne l'a jamais affronté. Choisir "Cote globale" dans le menu déroulant de la colonne "Cote par style" revient aux tous styles confondus.`,
            `The hardest *displayed* grade they actually sent in the "${styleSelectionne}" style — dash if they never faced it. Pick "Overall rating" in the "Cote par style" column's dropdown to go back to all styles combined.`
          )
        : t(
            "La cotation *affichée* la plus dure qu'il ait réellement envoyée. Elle dépasse souvent le niveau calculé, qui vise la cotation réussie une fois sur deux et non le record.",
            "The hardest *displayed* grade they actually sent. It often exceeds the calculated level, which targets the grade sent half the time, not their personal record."
          ),
      valeur: (g) => (styleSelectionne ? (g.meilleureCotationParStyle[styleSelectionne] ?? null) : g.meilleureCotation),
    },
    ...(simplifie
      ? []
      : [
          {
            cle: 'matchs',
            titre: styleSelectionne ? t(`Duels utiles (${styleSelectionne})`, `Useful duels (${styleSelectionne})`) : t('Duels utiles', 'Useful duels'),
            num: true,
            aide: styleSelectionne
              ? t(
                  `Nombre de blocs de style "${styleSelectionne}" qu'il a affrontés et dont l'issue a compté.`,
                  `Number of "${styleSelectionne}"-style boulders they faced whose outcome counted.`
                )
              : t(
                  "Nombre de blocs qu'il a affrontés et dont l'issue a compté. Les blocs largement hors de sa portée, dans un sens comme dans l'autre, n'y figurent pas.",
                  "Number of boulders they faced whose outcome counted. Boulders far out of their reach either way are excluded."
                ),
            valeur: (g: LigneGrimpeur) => (styleSelectionne ? (enStyle(g)?.matchs ?? 0) : g.matchs),
          },
        ]),
    {
      cle: 'taux',
      titre: styleSelectionne ? t(`Duels gagnés (${styleSelectionne})`, `Duels won (${styleSelectionne})`) : t('Duels gagnés', 'Duels won'),
      num: true,
      aide: styleSelectionne
        ? t(
            `Part des blocs de style "${styleSelectionne}" qu'il a fini par envoyer — tiret s'il ne l'a jamais affronté.`,
            `Share of "${styleSelectionne}"-style boulders they eventually sent — dash if they never faced it.`
          )
        : t(
            "Part de ces blocs qu'il a fini par envoyer. Un taux élevé signale surtout quelqu'un qui choisit des blocs à sa portée, pas nécessairement un bon grimpeur.",
            "Share of those boulders they eventually sent. A high rate mostly signals someone who picks boulders within reach, not necessarily a strong climber."
          ),
      valeur: (g) => {
        const e = enStyle(g)
        return styleSelectionne ? (e && e.matchs ? e.reussites / e.matchs : 0) : g.tauxReussite
      },
      rendu: (g) => {
        const e = enStyle(g)
        if (!styleSelectionne) return pourcent(g.tauxReussite)
        return e && e.matchs ? pourcent(e.reussites / e.matchs) : <span className="discret">—</span>
      },
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

  // Rang qu'aurait le compte s'il etait classe, sans le placer dans le tableau.
  const monRangProvisoire = moiProvisoire
    ? classement.filter((g) => g.rating > moiProvisoire.rating).length + 1
    : 0
  const meilleur = classement[0]
  const median = classement[Math.floor(classement.length / 2)]

  return (
    <div className="large">
      <div className="grille tuiles">
        {/* Une fois classe, le grimpeur connecte se retrouve dans le tableau,
            surligne en vert (et ajoute apres « ⋯ » s'il est au-dela des lignes
            affichees, cf. `enEvidence`) : la tuile ne sert que pendant la
            periode d'essai, ou il n'y figure pas. */}
        {moiProvisoire && (
          <Tuile
            heros
            vert
            etiquette={t('Votre position provisoire', 'Your provisional rank')}
            valeur={t(`${monRangProvisoire}${monRangProvisoire === 1 ? 'er' : 'e'}`, `#${monRangProvisoire}`)}
            note={t(
              `${moiProvisoire.blocsTentes} blocs sur ${DUELS_PROVISOIRES} : votre pseudonyme apparaîtra au classement après ${DUELS_PROVISOIRES} blocs différents.`,
              `${moiProvisoire.blocsTentes} boulders of ${DUELS_PROVISOIRES}: your username will appear in the rankings after ${DUELS_PROVISOIRES} different boulders.`
            )}
          />
        )}
        <Tuile
          etiquette={t('Grimpeurs classés', 'Ranked climbers')}
          valeur={nombre(classement.length)}
          note={
            enEssai
              ? t(
                  `au moins ${DUELS_PROVISOIRES} blocs tentés ; ${nombre(enEssai)} en période d'essai`,
                  `at least ${DUELS_PROVISOIRES} boulders tried; ${nombre(enEssai)} on trial`
                )
              : t(`au moins ${DUELS_PROVISOIRES} blocs tentés`, `at least ${DUELS_PROVISOIRES} boulders tried`)
          }
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
          'Le niveau calculé est la cotation V que le grimpeur envoie une fois sur deux.',
          'The calculated level is the V grade the climber sends half the time.'
        )}
      >
        {definirMasque && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={masqueAffiche}
                disabled={masqueEnCours !== null}
                onChange={(e) => void basculerMasque(e.currentTarget.checked)}
              />
              {t('Je ne souhaite pas apparaître dans le classement', "I don't want to appear in the leaderboard")}
            </label>
            {erreurMasque && <p style={{ color: 'var(--critique)', margin: '4px 0 0' }}>{erreurMasque}</p>}
            {masqueAffiche && (
              <p className="sous-titre" style={{ margin: '4px 0 0' }}>
                {t(
                  'Votre pseudonyme est retiré du classement pour tout le monde. Vos envois comptent toujours dans le calcul des cotes des blocs, et vous seul voyez vos cotes ci-dessous.',
                  'Your username is removed from the leaderboard for everyone. Your sends still count toward boulder ratings, and only you see your ratings below.'
                )}
              </p>
            )}
            {masqueAffiche && moiHorsClassement && (
              <div style={{ marginTop: 8 }}>
                <Tableau
                  lignes={[moiHorsClassement]}
                  // Le menu de style reste dans l'en-tete du classement : il
                  // pilote aussi cette ligne, inutile de l'y doubler.
                  colonnes={colonnes.map(({ titreRendu, ...c }) =>
                    titreRendu ? { ...c, titre: styleSelectionne || t('Cote calculée', 'Calculated rating') } : c
                  )}
                  cleLigne={(g) => g.id}
                  enEvidence={moiHorsClassement.id}
                  sansPied
                />
              </div>
            )}
          </div>
        )}
        <Tableau
          lignes={classement}
          colonnes={colonnes}
          cleLigne={(g) => g.id}
          tri={triClassement}
          onTri={setTriClassement}
          pageTaille={25}
          enEvidence={moi ?? undefined}
        />
      </Carte>

      <Carte
        titre={t('Distribution des grimpeurs', 'Climber distribution')}
        sousTitre={t(
          'Nombre de grimpeurs classés par niveau calculé (la cotation envoyée une fois sur deux).',
          'Number of ranked climbers by calculated level (the grade sent half the time).'
        )}
      >
        <Histogramme
          valeurs={classement.map((g) => g.indexNiveau)}
          uniteX={t('cote V', 'V grade')}
          uniteY={t('grimpeurs', 'climbers')}
        />
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
      memoire="progression"
      pageTaille={20}
      videMessage={t('Sélectionner au moins un grimpeur.', 'Select at least one climber.')}
    />
  )
}
