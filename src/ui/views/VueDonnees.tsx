import { useMemo, useState } from 'react'
import { versCsv } from '../../core/loaders/csv'
import type { Dataset } from '../../core/types'
import { Carte } from '../components/base'
import { Tableau, type Colonne } from '../components/Tableau'
import { dateCourte, nombre, telecharger } from '../format'

type Onglet = 'grimpeurs' | 'blocs' | 'ascensions'

/** Les donnees telles qu'elles sont, apres validation : filtrables et exportables. */
export function VueDonnees({ dataset }: { dataset: Dataset }) {
  const [onglet, setOnglet] = useState<Onglet>('blocs')
  const [recherche, setRecherche] = useState('')

  const q = recherche.trim().toLowerCase()
  const correspond = (...champs: (string | number | null)[]) =>
    !q || champs.some((c) => String(c ?? '').toLowerCase().includes(q))

  const grimpeurs = useMemo(
    () => dataset.grimpeurs.filter((g) => correspond(g.nom, g.gymPrincipal, g.id)),
    [dataset, q]
  )
  const blocs = useMemo(
    () => dataset.blocs.filter((b) => correspond(b.nom, b.gym, b.secteur, b.couleur, b.cotationOfficielle, b.id)),
    [dataset, q]
  )
  const ascensions = useMemo(() => {
    // Le rang sert de cle de ligne : deux lignes peuvent partager grimpeur,
    // bloc, date et nombre d'essais sans etre la meme.
    const enrichies = dataset.ascensions.map((a, rang) => ({
      ...a,
      rang,
      grimpeur: dataset.grimpeurParId.get(a.grimpeurId)?.nom ?? a.grimpeurId,
      bloc: dataset.blocParId.get(a.blocId)?.nom ?? a.blocId,
      gym: dataset.blocParId.get(a.blocId)?.gym ?? '',
      cotation: dataset.blocParId.get(a.blocId)?.cotationOfficielle ?? '',
    }))
    return enrichies.filter((a) => correspond(a.grimpeur, a.bloc, a.gym, a.cotation, a.resultat))
  }, [dataset, q])

  const colGrimpeurs: Colonne<(typeof grimpeurs)[number]>[] = [
    { cle: 'nom', titre: 'Nom', principal: true, valeur: (g) => g.nom },
    { cle: 'gym', titre: 'Salle principale', valeur: (g) => g.gymPrincipal },
    { cle: 'sexe', titre: 'Sexe', valeur: (g) => g.sexe },
    {
      cle: 'saison',
      titre: 'Premiere saison',
      num: true,
      valeur: (g) => g.premiereSaison,
      rendu: (g) => String(g.premiereSaison),
    },
    { cle: 'id', titre: 'Identifiant', valeur: (g) => g.id, rendu: (g) => <span className="mono">{g.id}</span> },
  ]

  const colBlocs: Colonne<(typeof blocs)[number]>[] = [
    { cle: 'nom', titre: 'Bloc', principal: true, valeur: (b) => b.nom },
    { cle: 'gym', titre: 'Salle', valeur: (b) => b.gym },
    { cle: 'secteur', titre: 'Secteur', valeur: (b) => b.secteur },
    { cle: 'couleur', titre: 'Couleur', valeur: (b) => b.couleur },
    { cle: 'cotation', titre: 'Cotation', valeur: (b) => b.cotationOfficielle, tri: (b) => b.indexOfficiel },
    { cle: 'ouverture', titre: 'Ouvert le', valeur: (b) => b.dateOuverture },
    {
      cle: 'retrait',
      titre: 'Retire le',
      valeur: (b) => b.dateRetrait,
      rendu: (b) => b.dateRetrait ?? <span className="puce ok">en place</span>,
    },
    { cle: 'id', titre: 'Identifiant', valeur: (b) => b.id, rendu: (b) => <span className="mono">{b.id}</span> },
  ]

  const colAscensions: Colonne<(typeof ascensions)[number]>[] = [
    { cle: 'date', titre: 'Date', valeur: (a) => a.date, tri: (a) => a.t, rendu: (a) => dateCourte(a.t) },
    { cle: 'grimpeur', titre: 'Grimpeur', principal: true, valeur: (a) => a.grimpeur },
    { cle: 'bloc', titre: 'Bloc', valeur: (a) => a.bloc },
    { cle: 'gym', titre: 'Salle', valeur: (a) => a.gym },
    { cle: 'cotation', titre: 'Cotation', valeur: (a) => a.cotation },
    {
      cle: 'resultat',
      titre: 'Resultat',
      valeur: (a) => a.resultat,
      rendu: (a) => (
        <span className={a.resultat === 'reussite' ? 'puce ok' : 'puce'}>
          {a.resultat === 'reussite' ? 'reussite' : 'echec'}
        </span>
      ),
    },
    { cle: 'essais', titre: 'Essais', num: true, valeur: (a) => a.essais },
  ]

  const exporter = () => {
    const lignes =
      onglet === 'grimpeurs'
        ? grimpeurs
        : onglet === 'blocs'
          ? blocs.map(({ indexOfficiel: _i, ...reste }) => reste)
          : ascensions.map(({ t: _t, rang: _r, ...reste }) => reste)
    telecharger(`${onglet}.csv`, versCsv(lignes as unknown as Record<string, unknown>[]))
  }

  const total = onglet === 'grimpeurs' ? grimpeurs.length : onglet === 'blocs' ? blocs.length : ascensions.length

  return (
    <div className="large">
      <div className="barre-outils">
        {(['grimpeurs', 'blocs', 'ascensions'] as Onglet[]).map((o) => (
          <button key={o} className="bouton" aria-pressed={onglet === o} onClick={() => setOnglet(o)}>
            {o[0].toUpperCase() + o.slice(1)}
          </button>
        ))}
        <input
          type="search"
          placeholder="Filtrer..."
          value={recherche}
          onChange={(e) => setRecherche(e.currentTarget.value)}
          style={{ width: 220 }}
        />
        <span className="discret" style={{ fontSize: 12 }}>
          {nombre(total)} lignes
        </span>
        <span className="espace" />
        <button className="bouton" onClick={exporter}>
          Exporter en CSV
        </button>
      </div>

      <Carte
        sousTitre={
          onglet === 'ascensions'
            ? "Toutes les lignes, y compris celles que la regle du premier envoi ecarte du calcul. Le nombre d'essais est conserve mais n'entre dans aucune cote."
            : undefined
        }
      >
        {onglet === 'grimpeurs' && (
          <Tableau lignes={grimpeurs} colonnes={colGrimpeurs} cleLigne={(g) => g.id} triInitial={{ cle: 'nom', sens: 1 }} />
        )}
        {onglet === 'blocs' && (
          <Tableau lignes={blocs} colonnes={colBlocs} cleLigne={(b) => b.id} triInitial={{ cle: 'cotation', sens: -1 }} />
        )}
        {onglet === 'ascensions' && (
          <Tableau
            lignes={ascensions}
            colonnes={colAscensions}
            cleLigne={(a) => String(a.rang)}
            triInitial={{ cle: 'date', sens: -1 }}
          />
        )}
      </Carte>
    </div>
  )
}
