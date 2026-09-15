import { useEffect, useMemo, useRef, useState } from 'react'
import { COTATIONS } from '../../core/cotations'
import { chargerCarte } from '../../core/cartes/sources'
import type { BlocCarte, Carte as DonneesCarte } from '../../core/cartes/types'
import type { Resultat } from '../../core/pipeline'
import type { EchecEnregistrement, TypeEnvoi } from '../etat'
import { Carte, Tuile } from '../components/base'
import { nombre, telecharger } from '../format'
import { useLangue } from '../langue'
import { definirGrimpeurChoisi, lireGrimpeurChoisi, suiviLocal } from '../suivi'

/**
 * Couleur des prises, du mauve au rouge (ordre du spectre visible), puis
 * noir et blanc ajoutes aux extremes. C'est la couleur reelle choisie par
 * l'ouvreur — elle ne depend pas de la cotation.
 *
 * Tons "metal" (amethyste, acier, emeraude, or, cuivre, rubis, gunmetal,
 * argent) plutot que des teintes plates : un reflet lustre commun
 * (BRILLANT) se superpose a la couleur de base de chaque pastille pour
 * l'effet lisse. Couleurs fixes, independantes du theme clair/sombre,
 * puisqu'il s'agit d'un attribut physique du bloc.
 */
const BRILLANT = 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.75), rgba(255,255,255,0) 58%)'

const PALETTE_COULEURS = [
  { id: 'mauve', fr: 'Mauve', en: 'Purple', fond: '#6a3093', texte: '#fff' },
  { id: 'bleu', fr: 'Bleu', en: 'Blue', fond: '#1f4e8c', texte: '#fff' },
  { id: 'vert', fr: 'Vert', en: 'Green', fond: '#197850', texte: '#fff' },
  { id: 'jaune', fr: 'Jaune', en: 'Yellow', fond: '#b8860b', texte: '#fff' },
  { id: 'orange', fr: 'Orange', en: 'Orange', fond: '#a15c2e', texte: '#fff' },
  { id: 'rouge', fr: 'Rouge', en: 'Red', fond: '#8c1c24', texte: '#fff' },
  { id: 'noir', fr: 'Noir', en: 'Black', fond: '#2b2b2f', texte: '#fff' },
  { id: 'blanc', fr: 'Blanc', en: 'White', fond: '#c9c9c9', texte: '#111' },
] as const

function infoCouleur(id: string) {
  return PALETTE_COULEURS.find((c) => c.id === id) ?? PALETTE_COULEURS[1]
}

/** Couleur de base + reflet lustre, pour un rendu "metal" plutot que plat. */
function fondMetal(id: string): string {
  return `${BRILLANT}, ${infoCouleur(id).fond}`
}

function nouvelId(): string {
  return `b${Date.now().toString(36)}${Math.round(Math.random() * 1000)}`
}

const RAYON = 20

export function VueCarte({
  centreId,
  accesComplet,
  resultatMelange,
  grimpeurs,
  enregistrerAscension,
  envoisConnus,
}: {
  centreId: string
  accesComplet: boolean
  /**
   * Resultat de la formule "melange", pour afficher la cote calculee a cote
   * de la cote affichee. Seul le centre demo a un jeu de donnees connecte :
   * pour les autres, ce sera `null` et la carte n'affiche que la cote
   * affichee, comme aujourd'hui.
   */
  resultatMelange?: Resultat | null
  /** Noms suggeres pour "quel grimpeur ?" (roster connu, ex. le centre demo). */
  grimpeurs?: string[]
  /**
   * Enregistre un envoi (flash/reussi/echec) comme une vraie ascension du
   * dataset. Absent pour un centre sans jeu de donnees connecte : les boutons
   * de la carte restent alors desactives (cf. `Atelier.enregistrerAscension`).
   */
  enregistrerAscension?: (blocId: string, grimpeurNom: string, type: TypeEnvoi) => 'ok' | EchecEnregistrement
  /** Blocs deja envoyes par un grimpeur nomme, d'apres l'ensemble du dataset. */
  envoisConnus?: (grimpeurNom: string) => Set<string>
}) {
  const { t } = useLangue()
  const [carte, setCarte] = useState<DonneesCarte | null>(null)
  const [selection, setSelection] = useState<string | null>(null)
  const [survole, setSurvole] = useState<string | null>(null)
  const [grimpeurChoisi, setGrimpeurChoisi] = useState('')
  const [suivi, setSuivi] = useState<Record<string, boolean>>({})
  const zoneRef = useRef<HTMLDivElement>(null)
  const editionRef = useRef<HTMLDivElement>(null)
  const glisse = useRef<{ id: string; deplace: boolean } | null>(null)

  const coteParId = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of resultatMelange?.blocs ?? []) m.set(b.id, b.rating)
    return m
  }, [resultatMelange])

  // Coherent avec le reste du jeu de donnees : un bloc deja reussi par ce
  // grimpeur (fichier + Carte confondus) se montre envoye sans qu'il ait
  // besoin de re-cliquer quoi que ce soit.
  const envoisReels = useMemo(
    () => envoisConnus?.(grimpeurChoisi) ?? new Set<string>(),
    [envoisConnus, grimpeurChoisi]
  )

  const grimpeurValide = useMemo(() => {
    const nom = grimpeurChoisi.trim().toLowerCase()
    return !!nom && !!grimpeurs?.some((g) => g.trim().toLowerCase() === nom)
  }, [grimpeurChoisi, grimpeurs])

  const actionsActives = !!enregistrerAscension && grimpeurValide
  const raisonInactif = !enregistrerAscension
    ? t("Ce centre n'a pas de jeu de données connecté.", 'This gym has no connected dataset.')
    : t(
        'Choisissez votre nom dans la liste des grimpeurs connus pour enregistrer un envoi.',
        'Pick your name from the list of known climbers to log a send.'
      )

  useEffect(() => {
    let vivant = true
    setCarte(null)
    setSelection(null)
    chargerCarte(centreId).then((c) => {
      if (vivant) setCarte(c)
    })
    const nom = lireGrimpeurChoisi(centreId)
    setGrimpeurChoisi(nom)
    setSuivi(suiviLocal.lire(centreId, nom))
    return () => {
      vivant = false
    }
  }, [centreId])

  const choisirGrimpeur = (nom: string) => {
    setGrimpeurChoisi(nom)
    definirGrimpeurChoisi(centreId, nom)
    setSuivi(suiviLocal.lire(centreId, nom))
  }

  const blocSelectionne = useMemo(
    () => carte?.blocs.find((b) => b.id === selection) ?? null,
    [carte, selection]
  )

  // Sur une grande carte, le panneau d'edition serait hors ecran sans ca :
  // rien ne dirait qu'un clic sur une pastille a fonctionne.
  useEffect(() => {
    if (selection) editionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [selection])

  if (!carte) return <p className="vide">{t('Chargement de la carte…', 'Loading the map…')}</p>

  const relatif = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = zoneRef.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }

  const ajouter = (e: React.MouseEvent) => {
    if (!accesComplet || glisse.current) return
    const { x, y } = relatif(e.clientX, e.clientY)
    const bloc: BlocCarte = { id: nouvelId(), x, y, cotation: 'V4', couleur: 'bleu', style: '' }
    setCarte({ ...carte, blocs: [...carte.blocs, bloc] })
    setSelection(bloc.id)
  }

  const modifier = (id: string, patch: Partial<BlocCarte>) => {
    setCarte({ ...carte, blocs: carte.blocs.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  }

  const supprimer = (id: string) => {
    setCarte({ ...carte, blocs: carte.blocs.filter((b) => b.id !== id) })
    setSelection(null)
  }

  const basculerEnvoye = (id: string) => {
    const valeur = !suivi[id]
    suiviLocal.definir(centreId, grimpeurChoisi, id, valeur)
    setSuivi({ ...suivi, [id]: valeur })
  }

  const enregistrer = (id: string, type: TypeEnvoi) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!enregistrerAscension || !grimpeurValide) return
    enregistrerAscension(id, grimpeurChoisi, type)
  }

  const debuterGlisse = (id: string) => (e: React.MouseEvent) => {
    if (!accesComplet) return
    e.stopPropagation()
    glisse.current = { id, deplace: false }
    const bouger = (ev: MouseEvent) => {
      glisse.current!.deplace = true
      modifier(id, relatif(ev.clientX, ev.clientY))
    }
    const relacher = () => {
      window.removeEventListener('mousemove', bouger)
      window.removeEventListener('mouseup', relacher)
      const fut = glisse.current
      glisse.current = null
      if (fut && !fut.deplace) setSelection(id)
    }
    window.addEventListener('mousemove', bouger)
    window.addEventListener('mouseup', relacher)
  }

  const exporter = () => {
    telecharger(`carte-${centreId}.json`, JSON.stringify(carte, null, 2), 'application/json')
  }

  const envoyes = carte.blocs.filter((b) => envoisReels.has(b.id) || suivi[b.id]).length

  return (
    <div className="large">
      <div className="barre-outils" style={{ marginBottom: 12 }}>
        <label htmlFor="carte-grimpeur" className="discret" style={{ fontSize: 13 }}>
          {t('Carte de :', "Map for:")}
        </label>
        <input
          id="carte-grimpeur"
          type="text"
          list="carte-grimpeurs-connus"
          value={grimpeurChoisi}
          onChange={(e) => choisirGrimpeur(e.currentTarget.value)}
          placeholder={t('votre nom', 'your name')}
          style={{ width: 220 }}
        />
        {grimpeurChoisi && (
          <button className="bouton discret" onClick={() => choisirGrimpeur('')}>
            {t('Effacer', 'Clear')}
          </button>
        )}
        {grimpeurs && grimpeurs.length > 0 && (
          <datalist id="carte-grimpeurs-connus">
            {grimpeurs.map((nom) => (
              <option key={nom} value={nom} />
            ))}
          </datalist>
        )}
      </div>

      <div className="grille tuiles">
        <Tuile etiquette={t('Blocs sur la carte', 'Boulders on the map')} valeur={String(carte.blocs.length)} />
        {carte.blocs.length > 0 && (
          <Tuile
            etiquette={
              grimpeurChoisi
                ? t(`Envoyés par ${grimpeurChoisi}`, `Sent by ${grimpeurChoisi}`)
                : t('Envoyés', 'Sent')
            }
            valeur={String(envoyes)}
            note={t('sur cet appareil', 'on this device')}
          />
        )}
      </div>

      <Carte
        titre={t('Carte des blocs', 'Boulder map')}
        sousTitre={
          accesComplet
            ? t(
                "Cliquer sur la carte pour ajouter un bloc. Cliquer un bloc existant pour le modifier, ou le glisser pour le repositionner.",
                'Click the map to add a boulder. Click an existing boulder to edit it, or drag it to reposition.'
              )
            : t(
                "Survolez un bloc pour l'enregistrer en flash, réussi ou échec.",
                'Hover a boulder to log it as a flash, a send or a fail.'
              )
        }
        actions={
          accesComplet ? (
            <button className="bouton" onClick={exporter}>
              {t('Exporter la carte (JSON)', 'Export the map (JSON)')}
            </button>
          ) : undefined
        }
      >
        <div
          ref={zoneRef}
          onClick={ajouter}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: carte.fond ? undefined : '4 / 3',
            borderRadius: 'var(--r)',
            overflow: 'hidden',
            cursor: accesComplet ? 'copy' : 'default',
            background: carte.fond
              ? 'var(--plan-creux)'
              : 'repeating-linear-gradient(45deg, var(--plan-creux), var(--plan-creux) 10px, var(--plan) 10px, var(--plan) 20px)',
            border: carte.fond ? undefined : '1px dashed var(--bord-fort)',
          }}
        >
          {carte.fond && (
            <img
              src={carte.fond}
              alt=""
              draggable={false}
              style={{ display: 'block', width: '100%', height: 'auto', userSelect: 'none' }}
            />
          )}
          {(() => {
            const zoneRect = zoneRef.current?.getBoundingClientRect()
            return carte.blocs.map((b) => {
              const fait = envoisReels.has(b.id) || !!suivi[b.id]
              const couleur = infoCouleur(b.couleur)
              const cote = coteParId.get(b.id)
              const ancreX = (zoneRect?.left ?? 0) + b.x * (zoneRect?.width ?? 0)
              const ancreY = (zoneRect?.top ?? 0) + b.y * (zoneRect?.height ?? 0)
              return (
                <div
                  key={b.id}
                  style={{ position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%` }}
                  onMouseEnter={() => setSurvole(b.id)}
                  onMouseLeave={() => setSurvole((s) => (s === b.id ? null : s))}
                >
                  <div
                    onMouseDown={debuterGlisse(b.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (accesComplet) setSelection(b.id)
                      else basculerEnvoye(b.id)
                    }}
                    style={{
                      position: 'absolute',
                      width: RAYON * 2,
                      height: RAYON * 2,
                      marginLeft: -RAYON,
                      marginTop: -RAYON,
                      borderRadius: '50%',
                      background: fondMetal(b.couleur),
                      boxShadow: `0 0 0 2px ${selection === b.id ? 'var(--encre)' : 'var(--bord-fort)'}, 0 1px 4px rgba(0,0,0,0.35), inset -3px -3px 6px rgba(0,0,0,0.4), inset 2px 2px 4px rgba(255,255,255,0.3)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: couleur.texte,
                      fontSize: 12,
                      fontWeight: 700,
                      textShadow: couleur.texte === '#fff' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                      cursor: accesComplet ? 'grab' : 'pointer',
                      opacity: !accesComplet && fait ? 0.45 : 1,
                    }}
                  >
                    {b.cotation.replace(/^V/i, '')}
                    {!accesComplet && fait && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: -2,
                          borderRadius: '50%',
                          border: '2px solid var(--bon)',
                        }}
                      />
                    )}
                  </div>

                  {survole === b.id && (
                    // `position: fixed` (plutot que relatif a la carte) pour echapper
                    // au `overflow: hidden` de la zone de carte : sinon un bloc pres
                    // d'un bord afficherait un popup coupe.
                    <div
                      className="carte-popup"
                      style={{
                        left: Math.min(ancreX + RAYON + 8, window.innerWidth - 200),
                        top: Math.max(8, ancreY - RAYON),
                      }}
                    >
                      <div className="t">{b.nom || b.cotation}</div>
                      <div className="l">
                        <span>{t('Cotation', 'Grade')}</span>
                        <b>{cote !== undefined ? `${b.cotation} (${nombre(cote)})` : b.cotation}</b>
                      </div>
                      <div className="l">
                        <span>{t('Couleur', 'Color')}</span>
                        <b>{t(couleur.fr, couleur.en)}</b>
                      </div>
                      <div className="l">
                        <span>{t('Style', 'Style')}</span>
                        <b>{b.style || '—'}</b>
                      </div>
                      <div className="carte-popup-actions">
                        <button
                          className="flash"
                          disabled={!actionsActives}
                          title={actionsActives ? t('Flash (réussi du premier coup)', 'Flash (sent first try)') : raisonInactif}
                          onClick={enregistrer(b.id, 'flash')}
                        >
                          ⚡
                        </button>
                        <button
                          className="reussi"
                          disabled={!actionsActives}
                          title={actionsActives ? t('Réussi', 'Sent') : raisonInactif}
                          onClick={enregistrer(b.id, 'reussi')}
                        >
                          ✓
                        </button>
                        <button
                          className="echec"
                          disabled={!actionsActives}
                          title={actionsActives ? t('Échec', 'Failed attempt') : raisonInactif}
                          onClick={enregistrer(b.id, 'echec')}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>

        {!carte.blocs.length && (
          <p className="vide">
            {accesComplet
              ? t('Aucun bloc pour ce centre. Cliquez sur la carte pour en ajouter un.', 'No boulders for this gym yet. Click the map to add one.')
              : t('Aucun bloc enregistré pour ce centre pour le moment.', 'No boulders registered for this gym yet.')}
          </p>
        )}
      </Carte>

      {accesComplet && blocSelectionne && (
        <div ref={editionRef}>
        <Carte titre={t('Modifier le bloc', 'Edit boulder')}>
          <div className="param">
            <div className="param-tete">
              <label>{t('Nom', 'Name')}</label>
            </div>
            <input
              type="text"
              value={blocSelectionne.nom ?? ''}
              placeholder={t('ex. DA-0002', 'e.g. DA-0002')}
              onChange={(e) => modifier(blocSelectionne.id, { nom: e.currentTarget.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div className="param">
            <div className="param-tete">
              <label>{t('Couleur', 'Color')}</label>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              {PALETTE_COULEURS.map((c) => (
                <button
                  key={c.id}
                  title={t(c.fr, c.en)}
                  aria-pressed={blocSelectionne.couleur === c.id}
                  onClick={() => modifier(blocSelectionne.id, { couleur: c.id })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    padding: 0,
                    background: fondMetal(c.id),
                    cursor: 'pointer',
                    boxShadow:
                      (blocSelectionne.couleur === c.id
                        ? '0 0 0 2px var(--encre), 0 0 0 4px var(--surface), '
                        : '0 0 0 2px var(--bord-fort), ') +
                      'inset -2px -2px 4px rgba(0,0,0,0.4), inset 1px 1px 3px rgba(255,255,255,0.35)',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="param">
            <div className="param-tete">
              <label>{t('Cotation', 'Grade')}</label>
            </div>
            <select
              value={blocSelectionne.cotation}
              onChange={(e) => modifier(blocSelectionne.id, { cotation: e.currentTarget.value })}
            >
              {COTATIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="param">
            <div className="param-tete">
              <label>{t('Style', 'Style')}</label>
            </div>
            <input
              type="text"
              value={blocSelectionne.style}
              placeholder={t('ex. Dalle, Dévers, Bat Cave…', 'e.g. Slab, Overhang, Bat Cave…')}
              onChange={(e) => modifier(blocSelectionne.id, { style: e.currentTarget.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div className="barre-outils" style={{ margin: '10px 0 0' }}>
            <button className="bouton" onClick={() => setSelection(null)}>
              {t('Fermer', 'Close')}
            </button>
            <button className="bouton discret" onClick={() => supprimer(blocSelectionne.id)}>
              {t('Supprimer', 'Delete')}
            </button>
          </div>
        </Carte>
        </div>
      )}

      {accesComplet && (
        <p className="param-aide" style={{ marginTop: 12 }}>
          {t(
            "Les changements restent locaux à cette session : exportez le fichier JSON et ajoutez-le à data/cartes/ pour qu'ils deviennent visibles pour tout le monde au prochain déploiement.",
            'Changes stay local to this session: export the JSON file and add it to data/cartes/ so it becomes visible to everyone on the next deployment.'
          )}
        </p>
      )}
    </div>
  )
}
