import { useMemo, useState } from 'react'
import { ratingVersIndex } from '../../core/calibrage'
import { FORMULES } from '../../core/formulas/registry'
import { formaterIndex } from '../../core/cotations'
import type { LigneGrimpeur, Resultat } from '../../core/pipeline'
import { BasculeVue } from '../charts/base'
import { COULEURS_SERIES, Courbes, type Serie } from '../charts/Courbes'
import { Carte, Tuile } from '../components/base'
import { Tableau, type Colonne } from '../components/Tableau'
import { dateCourte, nombre, pourcent } from '../format'
import { echantillonner } from '../etat'

/** Au-dela, les teintes ne se distinguent plus de facon fiable. */
const MAX_SERIES = 4

export function VueGrimpeurs({
  resultat,
  resultats,
}: {
  resultat: Resultat
  resultats: Map<string, Resultat>
}) {
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
      aide: 'Rang au classement, par cote decroissante.',
      valeur: (g) => classement.indexOf(g) + 1,
      tri: (g) => classement.indexOf(g),
    },
    {
      cle: 'nom',
      titre: 'Grimpeur',
      principal: true,
      aide: "Une pastille de couleur signale les grimpeurs traces dans la courbe de progression.",
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
          { cle: 'gym', titre: 'Salle', valeur: (g: LigneGrimpeur) => g.gymPrincipal },
          {
            cle: 'salles',
            titre: 'Salles',
            num: true,
            valeur: (g: LigneGrimpeur) => g.gyms.length,
            rendu: (g: LigneGrimpeur) =>
              g.gyms.length > 1 ? <span className="puce">{g.gyms.length}</span> : '1',
          },
        ]
      : []),
    {
      cle: 'niveau',
      titre: 'Niveau calcule',
      aide:
        "La cotation que ce grimpeur envoie une fois sur deux : sa cote traduite en crans V. La fraction entre parentheses evite d'arrondir un V5,4 en V5 tout court.",
      valeur: (g) => g.cotationNiveau,
      tri: (g) => g.indexNiveau,
      rendu: (g) => formaterIndex(g.indexNiveau),
    },
    ...cotesParFormule.map((c) => ({
      cle: `cote-${c.formule.id}`,
      titre: c.formule.labelCourt ?? c.formule.label,
      num: true,
      aide:
        `Cote du grimpeur selon la formule "${c.formule.label}". Divisez par 1000 pour la lire en crans V : 5300 = V5,3. Un grimpeur cote 1000 points au-dessus d'un bloc l'envoie neuf fois sur dix.`,
      valeur: (g: LigneGrimpeur) => c.parGrimpeur.get(g.id)?.rating ?? Number.NaN,
      rendu: (g: LigneGrimpeur) => {
        const ligne = c.parGrimpeur.get(g.id)
        if (!ligne || !Number.isFinite(ligne.rating)) return <span className="discret">—</span>
        const courante = c.formule.id === resultat.formuleId
        return <span style={{ fontWeight: courante ? 600 : undefined }}>{nombre(ligne.rating)}</span>
      },
    })),
    {
      cle: 'meilleure',
      titre: 'Plus dur envoye',
      aide:
        "La cotation *affichee* la plus dure qu'il ait reellement envoyee. Elle depasse souvent le niveau calcule, qui vise la cotation reussie une fois sur deux et non le record.",
      valeur: (g) => g.meilleureCotation,
    },
    {
      cle: 'matchs',
      titre: 'Duels utiles',
      num: true,
      aide:
        "Nombre de blocs qu'il a affrontes et dont l'issue a compte. Les blocs largement hors de sa portee, dans un sens comme dans l'autre, n'y figurent pas.",
      valeur: (g) => g.matchs,
    },
    {
      cle: 'taux',
      titre: 'Duels gagnes',
      num: true,
      aide:
        "Part de ces blocs qu'il a fini par envoyer. Un taux eleve signale surtout quelqu'un qui choisit des blocs a sa portee, pas necessairement un bon grimpeur.",
      valeur: (g) => g.tauxReussite,
      rendu: (g) => pourcent(g.tauxReussite),
    },
    {
      cle: 'suivi',
      titre: 'Courbe',
      aide: `Ajoute ou retire ce grimpeur de la courbe de progression, ${MAX_SERIES} au maximum.`,
      valeur: (g) => (choisis.includes(g.id) ? 'oui' : 'non'),
      rendu: (g) => (
        <button className="bouton discret" aria-pressed={choisis.includes(g.id)} onClick={() => basculer(g.id)}>
          {choisis.includes(g.id) ? 'Retirer' : 'Suivre'}
        </button>
      ),
    },
  ]

  const meilleur = classement[0]
  const median = classement[Math.floor(classement.length / 2)]

  return (
    <div className="large">
      <div className="grille tuiles">
        <Tuile etiquette="Grimpeurs classes" valeur={nombre(classement.length)} note="au moins un affrontement" />
        <Tuile
          etiquette="Meilleur niveau"
          valeur={meilleur ? formaterIndex(meilleur.indexNiveau) : '—'}
          note={meilleur?.nom}
        />
        <Tuile
          etiquette="Niveau median"
          valeur={median ? formaterIndex(median.indexNiveau) : '—'}
          note="la moitie du groupe est au-dessus"
        />
        <Tuile
          etiquette="Duels par grimpeur"
          valeur={nombre(classement.reduce((s, g) => s + g.matchs, 0) / (classement.length || 1))}
          note="en moyenne"
        />
      </div>

      <Carte
        titre="Progression"
        sousTitre={`Niveau estime au fil du temps, ${MAX_SERIES} grimpeurs au maximum. Choisir qui suivre dans le tableau ci-dessous.`}
        actions={<BasculeVue tableau={tableau} setTableau={setTableau} />}
      >
        {tableau ? (
          <TableauProgression series={series} />
        ) : (
          <Courbes series={series} formatY={(v) => formaterIndex(v).split(' ')[0]} />
        )}
      </Carte>

      <Carte
        titre="Classement"
        sousTitre="Le niveau calcule est la cotation V que le grimpeur envoie une fois sur deux. Les cotes des deux formules sont affichees cote a cote ; celle en gras est la formule active."
      >
        <Tableau lignes={classement} colonnes={colonnes} cleLigne={(g) => g.id} triInitial={{ cle: 'rang', sens: 1 }} />
      </Carte>
    </div>
  )
}

function TableauProgression({ series }: { series: Serie[] }) {
  const lignes = series.flatMap((s) => s.points.map((p) => ({ nom: s.label, ...p })))
  return (
    <Tableau
      lignes={lignes}
      colonnes={[
        { cle: 'nom', titre: 'Grimpeur', principal: true, valeur: (l) => l.nom },
        { cle: 'date', titre: 'Date', valeur: (l) => dateCourte(l.t), tri: (l) => l.t },
        { cle: 'niveau', titre: 'Niveau', valeur: (l) => formaterIndex(l.v), tri: (l) => l.v },
      ]}
      cleLigne={(l) => `${l.nom}-${l.t}`}
      triInitial={{ cle: 'date', sens: 1 }}
      pageTaille={20}
      videMessage="Selectionner au moins un grimpeur."
    />
  )
}
