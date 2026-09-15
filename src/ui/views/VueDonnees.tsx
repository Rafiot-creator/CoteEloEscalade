import { useMemo, useState } from 'react'
import { versCsv } from '../../core/loaders/csv'
import type { Dataset } from '../../core/types'
import { Carte } from '../components/base'
import { Tableau, type Colonne } from '../components/Tableau'
import { dateCourte, nombre, telecharger } from '../format'
import { useLangue } from '../langue'

type Onglet = 'grimpeurs' | 'blocs' | 'ascensions'

/** Les donnees telles qu'elles sont, apres validation : filtrables et exportables. */
export function VueDonnees({ dataset }: { dataset: Dataset }) {
  const { t } = useLangue()
  const [onglet, setOnglet] = useState<Onglet>('blocs')
  const [recherche, setRecherche] = useState('')

  const ongletLabel: Record<Onglet, string> = {
    grimpeurs: t('Grimpeurs', 'Climbers'),
    blocs: t('Blocs', 'Boulders'),
    ascensions: t('Ascensions', 'Ascents'),
  }

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
    { cle: 'nom', titre: t('Nom', 'Name'), principal: true, valeur: (g) => g.nom },
    {
      cle: 'gym',
      titre: t('Salle principale', 'Main gym'),
      valeur: (g) => g.gymPrincipal,
      aide: t("Salle déclarée à l'inscription.", 'Gym declared at sign-up.'),
    },
    { cle: 'sexe', titre: t('Sexe', 'Sex'), valeur: (g) => g.sexe, aide: t("Enregistré, mais n'entre dans aucun calcul.", "Recorded, but plays no part in any calculation.") },
    {
      cle: 'niveau',
      titre: t('Niveau déclaré', 'Declared level'),
      valeur: (g) => (g.niveauDeclare === null ? null : `V${g.niveauDeclare}`),
      tri: (g) => g.niveauDeclare ?? -1,
      rendu: (g) =>
        g.niveauDeclare === null ? <span className="discret">{t('non renseigné', 'not provided')}</span> : `V${g.niveauDeclare}`,
      aide: t(
        "Niveau annoncé à l'inscription. Il sert de cote de départ au grimpeur ; s'il manque, elle est estimée depuis les blocs de ses douze premiers duels.",
        "Level announced at sign-up. It serves as the climber's starting rating; if missing, it is estimated from the boulders in their first twelve duels."
      ),
    },
    {
      cle: 'saison',
      titre: t('Première saison', 'First season'),
      num: true,
      valeur: (g) => g.premiereSaison,
      rendu: (g) => String(g.premiereSaison),
      aide: t("Année de la première venue. Métadonnée : elle n'entre dans aucun calcul.", "Year of the first visit. Metadata only: it plays no part in any calculation."),
    },
    {
      cle: 'id',
      titre: t('Identifiant', 'ID'),
      valeur: (g) => g.id,
      rendu: (g) => <span className="mono">{g.id}</span>,
      aide: t('Clé utilisée dans le fichier des ascensions pour désigner ce grimpeur.', 'Key used in the ascents file to reference this climber.'),
    },
  ]

  const colBlocs: Colonne<(typeof blocs)[number]>[] = [
    { cle: 'nom', titre: t('Bloc', 'Boulder'), principal: true, valeur: (b) => b.nom },
    { cle: 'gym', titre: t('Salle', 'Gym'), valeur: (b) => b.gym },
    { cle: 'secteur', titre: t('Style', 'Style'), valeur: (b) => b.secteur, aide: t('Type de mur ou de mouvement.', 'Wall type or movement style.') },
    {
      cle: 'couleur',
      titre: t('Couleur', 'Color'),
      valeur: (b) => b.couleur,
      aide: t("Couleur des prises. Métadonnée : elle n'entre dans aucun calcul.", "Hold color. Metadata only: it plays no part in any calculation."),
    },
    {
      cle: 'cotation',
      titre: t('Cotation', 'Grade'),
      valeur: (b) => b.cotationOfficielle,
      tri: (b) => b.indexOfficiel,
      aide: t("La cotation annoncée par l'ouvreur, telle qu'elle figure sur l'étiquette.", "The grade announced by the setter, as it appears on the tag."),
    },
    { cle: 'ouverture', titre: t('Ouvert le', 'Set on'), valeur: (b) => b.dateOuverture, aide: t('Date de mise en place du bloc.', 'Date the boulder was set.') },
    {
      cle: 'retrait',
      titre: t('Retiré le', 'Stripped on'),
      valeur: (b) => b.dateRetrait,
      rendu: (b) => b.dateRetrait ?? <span className="puce ok">{t('en place', 'in place')}</span>,
      aide: t(
        "Date de démontage. Un bloc n'est grimpable qu'entre ces deux dates, ce qui borne le nombre de duels qu'il peut accumuler.",
        "Strip date. A boulder is only climbable between these two dates, which caps the number of duels it can accumulate."
      ),
    },
    {
      cle: 'id',
      titre: t('Identifiant', 'ID'),
      valeur: (b) => b.id,
      rendu: (b) => <span className="mono">{b.id}</span>,
      aide: t('Clé utilisée dans le fichier des ascensions pour désigner ce bloc.', 'Key used in the ascents file to reference this boulder.'),
    },
  ]

  const colAscensions: Colonne<(typeof ascensions)[number]>[] = [
    {
      cle: 'date',
      titre: t('Date', 'Date'),
      valeur: (a) => a.date,
      tri: (a) => a.t,
      rendu: (a) => dateCourte(a.t),
      aide: t('Jour de la séance. Une ligne par séance, pas par essai.', 'Day of the session. One row per session, not per attempt.'),
    },
    { cle: 'grimpeur', titre: t('Grimpeur', 'Climber'), principal: true, valeur: (a) => a.grimpeur },
    { cle: 'bloc', titre: t('Bloc', 'Boulder'), valeur: (a) => a.bloc },
    { cle: 'gym', titre: t('Salle', 'Gym'), valeur: (a) => a.gym },
    { cle: 'cotation', titre: t('Cotation', 'Grade'), valeur: (a) => a.cotation, aide: t('Cotation affichée du bloc ce jour-là.', "The boulder's displayed grade on that day.") },
    {
      cle: 'resultat',
      titre: t('Résultat', 'Result'),
      valeur: (a) => a.resultat,
      aide: t(
        "Issue de la séance. Plusieurs lignes d'un même couple grimpeur-bloc se replient ensuite en un seul duel : c'est le fait d'avoir fini par envoyer qui compte, pas le détail des séances.",
        "Outcome of the session. Several rows for the same climber-boulder pair later fold into a single duel: what matters is whether they eventually sent it, not the session-by-session detail."
      ),
      rendu: (a) => (
        <span className={a.resultat === 'reussite' ? 'puce ok' : 'puce'}>
          {a.resultat === 'reussite' ? t('réussite', 'send') : t('échec', 'fail')}
        </span>
      ),
    },
    {
      cle: 'essais',
      titre: t('Essais', 'Attempts'),
      num: true,
      aide: t(
        "Nombre de tentatives dans la séance. Il ne décide jamais de l'issue ; il sert seulement à pondérer une victoire, un flash pesant plus lourd qu'un enchaînement laborieux.",
        "Number of attempts in the session. It never decides the outcome; it only weights a win, a flash counting for more than a hard-fought send."
      ),
      valeur: (a) => a.essais,
    },
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
            {ongletLabel[o]}
          </button>
        ))}
        <input
          type="search"
          placeholder={t('Filtrer...', 'Filter...')}
          value={recherche}
          onChange={(e) => setRecherche(e.currentTarget.value)}
          style={{ width: 220 }}
        />
        <span className="discret" style={{ fontSize: 12 }}>
          {t(`${nombre(total)} lignes`, `${nombre(total)} rows`)}
        </span>
        <span className="espace" />
        <button className="bouton" onClick={exporter}>
          {t('Exporter en CSV', 'Export as CSV')}
        </button>
      </div>

      <Carte
        sousTitre={
          onglet === 'ascensions'
            ? t(
                "Toutes les lignes, y compris celles que la règle du premier envoi écarte du calcul. Le nombre d'essais est conservé mais n'entre dans aucune cote.",
                "All rows, including those the first-send rule excludes from the calculation. The number of attempts is kept but plays no part in any rating."
              )
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
