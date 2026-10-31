import { useCallback, useEffect, useState } from 'react'
import { libelleCote, type Echelle } from '../../core/echelles'
import { supabase } from '../../core/supabase'
import { Carte } from '../components/base'
import { Tableau, type Colonne } from '../components/Tableau'
import { nombre } from '../format'
import { useLangue } from '../langue'

type TypeEnvoi = 'flash' | 'reussi' | 'echec'

interface Centre {
  nom: string
  echelle: Echelle
}
interface BlocTrouve {
  id: string
  nom: string
  centre_id: string
  cotation_officielle: string
  couleur: string
  special: boolean
  date_retrait: string | null
}
interface LigneAscension {
  id: number
  date: string
  type: TypeEnvoi
  /** Grimpeur (vue d'un bloc) ou bloc (vue d'un grimpeur), selon la selection. */
  grimpeur?: { id: string; nom: string }
  bloc?: BlocTrouve
}
type Selection = { genre: 'grimpeur'; id: string; nom: string } | { genre: 'bloc'; bloc: BlocTrouve }

const typeEnvoi = (resultat: string, essais: number): TypeEnvoi =>
  resultat === 'echec' ? 'echec' : essais === 1 ? 'flash' : 'reussi'

/**
 * Corriger les erreurs et effacer les tests, reserve a l'admin general :
 * chercher un grimpeur ou un bloc (y compris demonte), voir ses ascensions,
 * en changer le resultat ou les effacer, supprimer un bloc pour de bon.
 *
 * Lit la base directement plutot que le jeu de donnees du calcul : celui-ci ne
 * couvre qu'un groupe de centres et ignore les blocs demontes sans ascension.
 * Chaque ecriture passe par une fonction de la base qui reverifie le droit
 * (supabase/migrations/20261030000300_administration.sql).
 */
export function VueAdministration({ apresModification }: { apresModification?: () => void }) {
  const { t } = useLangue()
  const [centres, setCentres] = useState<Map<string, Centre>>(new Map())
  const [recherche, setRecherche] = useState('')
  const [grimpeurs, setGrimpeurs] = useState<{ id: string; nom: string }[]>([])
  const [blocs, setBlocs] = useState<BlocTrouve[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [ascensions, setAscensions] = useState<LigneAscension[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    void supabase
      .from('centres')
      .select('id, nom, echelle')
      .returns<{ id: string; nom: string; echelle: Echelle }[]>()
      .then(({ data }) => setCentres(new Map((data ?? []).map((c) => [c.id, { nom: c.nom, echelle: c.echelle }]))))
  }, [])

  // Recherche, un peu apres la derniere frappe.
  useEffect(() => {
    // Caracteres reserves de la syntaxe de filtre de l'API : retires.
    const q = recherche.replace(/[,()*%\\]/g, ' ').trim()
    if (q.length < 2) {
      setGrimpeurs([])
      setBlocs([])
      return
    }
    let vivant = true
    const minuterie = setTimeout(async () => {
      const [g, b] = await Promise.all([
        supabase.from('grimpeurs').select('id, nom').ilike('nom', `%${q}%`).order('nom').limit(20),
        supabase
          .from('blocs')
          .select('id, nom, centre_id, cotation_officielle, couleur, special, date_retrait')
          .or(`nom.ilike.*${q}*,id.ilike.*${q}*`)
          .order('centre_id')
          .order('nom')
          .limit(30)
          .returns<BlocTrouve[]>(),
      ])
      if (!vivant) return
      setErreur(g.error?.message ?? b.error?.message ?? null)
      setGrimpeurs(g.data ?? [])
      setBlocs(b.data ?? [])
    }, 300)
    return () => {
      vivant = false
      clearTimeout(minuterie)
    }
  }, [recherche, generation])

  // Ascensions de la selection.
  useEffect(() => {
    if (!selection) {
      setAscensions(null)
      return
    }
    let vivant = true
    setAscensions(null)
    const requete =
      selection.genre === 'grimpeur'
        ? supabase
            .from('ascensions')
            .select('id, date, resultat, essais, blocs(id, nom, centre_id, cotation_officielle, couleur, special, date_retrait)')
            .eq('grimpeur_id', selection.id)
        : supabase
            .from('ascensions')
            .select('id, date, resultat, essais, grimpeurs(id, nom)')
            .eq('bloc_id', selection.bloc.id)
    void requete
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .limit(1000)
      .returns<
        { id: number; date: string; resultat: string; essais: number; blocs?: BlocTrouve; grimpeurs?: { id: string; nom: string } }[]
      >()
      .then(({ data, error }) => {
        if (!vivant) return
        if (error) setErreur(error.message)
        setAscensions(
          (data ?? []).map((a) => ({
            id: a.id,
            date: a.date,
            type: typeEnvoi(a.resultat, a.essais),
            grimpeur: a.grimpeurs,
            bloc: a.blocs,
          }))
        )
      })
    return () => {
      vivant = false
    }
  }, [selection, generation])

  /** Lance une fonction d'administration de la base, puis relit tout. */
  const ecrire = useCallback(
    async (fonction: string, args: Record<string, unknown>) => {
      setErreur(null)
      const { error } = await supabase.rpc(fonction, args)
      if (error) setErreur(error.message)
      setGeneration((g) => g + 1)
      apresModification?.()
      return !error
    },
    [apresModification]
  )

  const libelleType: Record<TypeEnvoi, string> = {
    flash: t('Flash', 'Flash'),
    reussi: t('Réussi', 'Sent'),
    echec: t('Échoué', 'Failed'),
  }
  const nomCentre = (id: string) => centres.get(id)?.nom ?? id
  const cotation = (b: BlocTrouve) => libelleCote(b.cotation_officielle, b.couleur, centres.get(b.centre_id)?.echelle ?? 'v', b.special)
  const etat = (b: BlocTrouve) => (b.date_retrait ? t(`démonté le ${b.date_retrait}`, `taken down ${b.date_retrait}`) : t('en place', 'up'))

  const supprimerBloc = async (b: BlocTrouve, nAscensions: number | null) => {
    const combien =
      nAscensions === null ? '' : t(` et ses ${nombre(nAscensions)} ascension(s)`, ` and its ${nombre(nAscensions)} ascent(s)`)
    if (!window.confirm(t(`Supprimer pour de bon le bloc « ${b.nom} »${combien} ? C'est irréversible.`, `Permanently delete boulder "${b.nom}"${combien}? This cannot be undone.`)))
      return
    if (await ecrire('admin_supprimer_bloc', { bloc: b.id })) {
      setSelection(null)
      setBlocs((liste) => liste.filter((x) => x.id !== b.id))
    }
  }

  const colonnesAscensions: Colonne<LigneAscension>[] = [
    { cle: 'date', titre: t('Date', 'Date'), valeur: (a) => a.date, tri: (a) => `${a.date}-${String(a.id).padStart(12, '0')}` },
    ...(selection?.genre === 'grimpeur'
      ? [
          {
            cle: 'bloc',
            titre: t('Bloc', 'Boulder'),
            principal: true,
            valeur: (a: LigneAscension) => a.bloc?.nom ?? '—',
            rendu: (a: LigneAscension) =>
              a.bloc ? (
                <button className="lien-bloc" onClick={() => a.bloc && setSelection({ genre: 'bloc', bloc: a.bloc })}>
                  {a.bloc.nom}
                </button>
              ) : (
                '—'
              ),
          },
          { cle: 'centre', titre: t('Centre', 'Gym'), valeur: (a: LigneAscension) => (a.bloc ? nomCentre(a.bloc.centre_id) : '—') },
          { cle: 'cotation', titre: t('Cotation', 'Grade'), valeur: (a: LigneAscension) => (a.bloc ? cotation(a.bloc) : '—') },
          { cle: 'etat', titre: t('État', 'Status'), valeur: (a: LigneAscension) => (a.bloc ? etat(a.bloc) : '—') },
        ]
      : [
          {
            cle: 'grimpeur',
            titre: t('Grimpeur', 'Climber'),
            principal: true,
            valeur: (a: LigneAscension) => a.grimpeur?.nom ?? '—',
            rendu: (a: LigneAscension) =>
              a.grimpeur ? (
                <button
                  className="lien-bloc"
                  onClick={() => a.grimpeur && setSelection({ genre: 'grimpeur', id: a.grimpeur.id, nom: a.grimpeur.nom })}
                >
                  {a.grimpeur.nom}
                </button>
              ) : (
                '—'
              ),
          },
        ]),
    {
      cle: 'resultat',
      titre: t('Résultat', 'Result'),
      valeur: (a) => libelleType[a.type],
      rendu: (a) => (
        <select
          value={a.type}
          style={{ width: 'auto' }}
          onChange={(e) => void ecrire('admin_modifier_ascension', { ascension: a.id, type: e.currentTarget.value })}
        >
          {(['flash', 'reussi', 'echec'] as TypeEnvoi[]).map((ty) => (
            <option key={ty} value={ty}>
              {libelleType[ty]}
            </option>
          ))}
        </select>
      ),
    },
    {
      cle: 'effacer',
      titre: '',
      valeur: () => null,
      rendu: (a) => (
        <button
          className="bouton"
          onClick={() => {
            const qui = selection?.genre === 'grimpeur' ? `${selection.nom} · ${a.bloc?.nom ?? ''}` : `${a.grimpeur?.nom ?? ''}`
            if (window.confirm(t(`Effacer cette ascension (${qui}, ${a.date}) ?`, `Delete this ascent (${qui}, ${a.date})?`)))
              void ecrire('admin_supprimer_ascension', { ascension: a.id })
          }}
        >
          {t('Effacer', 'Delete')}
        </button>
      ),
    },
  ]

  const colonnesBlocs: Colonne<BlocTrouve>[] = [
    {
      cle: 'nom',
      titre: t('Bloc', 'Boulder'),
      principal: true,
      valeur: (b) => b.nom,
      rendu: (b) => (
        <button className="lien-bloc" onClick={() => setSelection({ genre: 'bloc', bloc: b })}>
          {b.nom}
        </button>
      ),
    },
    { cle: 'centre', titre: t('Centre', 'Gym'), valeur: (b) => nomCentre(b.centre_id) },
    { cle: 'cotation', titre: t('Cotation', 'Grade'), valeur: (b) => cotation(b) },
    { cle: 'etat', titre: t('État', 'Status'), valeur: (b) => etat(b) },
  ]

  return (
    <div className="large">
      <SectionCommentaires />

      <div className="barre-outils">
        <input
          type="search"
          placeholder={t('Chercher un grimpeur ou un bloc…', 'Search for a climber or a boulder…')}
          value={recherche}
          onChange={(e) => setRecherche(e.currentTarget.value)}
          style={{ width: 300 }}
        />
      </div>

      {erreur && (
        <div className="carte" style={{ borderColor: 'var(--critique)' }}>
          <p className="sous-titre">{erreur}</p>
        </div>
      )}

      {recherche.trim().length >= 2 && (
        <Carte titre={t('Résultats', 'Results')}>
          <p className="param-aide">{t('Grimpeurs', 'Climbers')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {grimpeurs.length === 0 && <span className="discret">{t('Aucun.', 'None.')}</span>}
            {grimpeurs.map((g) => (
              <button
                key={g.id}
                className="bouton"
                aria-pressed={selection?.genre === 'grimpeur' && selection.id === g.id}
                onClick={() => setSelection({ genre: 'grimpeur', id: g.id, nom: g.nom })}
              >
                {g.nom}
              </button>
            ))}
          </div>
          <p className="param-aide">{t('Blocs (y compris démontés)', 'Boulders (including taken down)')}</p>
          <Tableau lignes={blocs} colonnes={colonnesBlocs} cleLigne={(b) => b.id} pageTaille={10} videMessage={t('Aucun.', 'None.')} />
        </Carte>
      )}

      {selection && (
        <Carte
          titre={
            selection.genre === 'grimpeur'
              ? t(`Ascensions de ${selection.nom}`, `${selection.nom}'s ascents`)
              : t(`Bloc ${selection.bloc.nom}`, `Boulder ${selection.bloc.nom}`)
          }
          sousTitre={
            selection.genre === 'bloc'
              ? `${nomCentre(selection.bloc.centre_id)} · ${cotation(selection.bloc)} · ${etat(selection.bloc)}`
              : t('Tous centres confondus.', 'All gyms.')
          }
          actions={
            selection.genre === 'bloc' ? (
              <button
                className="bouton"
                style={{ color: 'var(--critique)' }}
                onClick={() => void supprimerBloc(selection.bloc, ascensions?.length ?? null)}
              >
                {t('Supprimer le bloc pour de bon', 'Delete boulder permanently')}
              </button>
            ) : undefined
          }
        >
          {ascensions === null ? (
            <p className="vide">{t('Chargement…', 'Loading…')}</p>
          ) : (
            <Tableau
              lignes={ascensions}
              colonnes={colonnesAscensions}
              cleLigne={(a) => String(a.id)}
              triInitial={{ cle: 'date', sens: -1 }}
              videMessage={t('Aucune ascension.', 'No ascents.')}
            />
          )}
        </Carte>
      )}
    </div>
  )
}

interface Commentaire {
  id: number
  cree_le: string
  type: 'probleme' | 'suggestion' | 'autre'
  message: string
  courriel: string | null
  pseudo: string | null
  centre: string | null
  appareil: string | null
  traite: boolean
}

/**
 * Messages de l'onglet Commentaires, du plus recent au plus ancien. Les
 * messages traites sont caches par defaut. Lecture et rangement par des
 * fonctions reservees a l'admin (supabase/migrations/20261031000300_commentaires.sql).
 */
function SectionCommentaires() {
  const { t } = useLangue()
  const [commentaires, setCommentaires] = useState<Commentaire[] | null>(null)
  const [voirTraites, setVoirTraites] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let vivant = true
    void supabase
      .rpc('admin_lister_commentaires')
      .then(({ data, error }) => {
        if (!vivant) return
        if (error) setErreur(error.message)
        // Du plus recent au plus ancien ; le numero departage deux messages de la meme seconde.
        setCommentaires([...((data as Commentaire[] | null) ?? [])].sort((x, y) => y.id - x.id))
      })
    return () => {
      vivant = false
    }
  }, [generation])

  const marquer = async (c: Commentaire, traite: boolean) => {
    setErreur(null)
    const { error } = await supabase.rpc('admin_marquer_commentaire', { commentaire: c.id, traite })
    if (error) setErreur(error.message)
    setGeneration((g) => g + 1)
  }

  const libelle = { probleme: t('Problème', 'Problem'), suggestion: t('Suggestion', 'Suggestion'), autre: t('Autre', 'Other') }
  const aTraiter = (commentaires ?? []).filter((c) => !c.traite)
  const affiches = voirTraites ? (commentaires ?? []) : aTraiter

  return (
    <Carte
      titre={t(`Commentaires (${aTraiter.length} à traiter)`, `Feedback (${aTraiter.length} to handle)`)}
      actions={
        <label className="discret" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={voirTraites} onChange={(e) => setVoirTraites(e.currentTarget.checked)} />
          {t('Voir aussi les messages traités', 'Also show handled messages')}
        </label>
      }
    >
      {erreur && <p style={{ color: 'var(--critique)' }}>{erreur}</p>}
      {commentaires === null ? (
        <p className="vide">{t('Chargement…', 'Loading…')}</p>
      ) : affiches.length === 0 ? (
        <p className="vide">{t('Aucun message à traiter.', 'No messages to handle.')}</p>
      ) : (
        affiches.map((c) => (
          <div key={c.id} className="param" style={{ opacity: c.traite ? 0.6 : 1 }}>
            <div className="param-tete">
              <label>
                <b>{libelle[c.type]}</b> · {new Date(c.cree_le).toLocaleString()}
                {c.pseudo ? ` · ${c.pseudo}` : ` · ${t('sans compte', 'no account')}`}
                {c.centre ? ` · ${c.centre}` : ''}
              </label>
              <button className="bouton" onClick={() => void marquer(c, !c.traite)}>
                {c.traite ? t('Rouvrir', 'Reopen') : t('Traité', 'Handled')}
              </button>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0' }}>{c.message}</p>
            {c.courriel && (
              <p className="param-aide">
                {t('Répondre à', 'Reply to')} <a href={`mailto:${c.courriel}`}>{c.courriel}</a>
              </p>
            )}
            {c.appareil && <p className="param-aide">{c.appareil}</p>}
          </div>
        ))
      )}
    </Carte>
  )
}
