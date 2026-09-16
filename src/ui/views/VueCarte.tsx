import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COTATIONS } from '../../core/cotations'
import { chargerCarte } from '../../core/cartes/sources'
import type { BlocCarte, Carte as DonneesCarte } from '../../core/cartes/types'
import type { Resultat } from '../../core/pipeline'
import type { EchecEnregistrement, StatutEnvoi, TypeEnvoi } from '../etat'
import { Carte, LegendeCote, Tuile } from '../components/base'
import { nombre, telecharger } from '../format'
import { useLangue } from '../langue'
import { definirGrimpeurChoisi, lireGrimpeurChoisi, suiviLocal } from '../suivi'

/**
 * Couleur des prises, du mauve au rouge (ordre du spectre visible), puis
 * noir et blanc ajoutes aux extremes. C'est la couleur reelle choisie par
 * l'ouvreur — elle ne depend pas de la cotation.
 *
 * Tons vifs plutot que des teintes plates : un reflet lustre commun
 * (BRILLANT) se superpose a la couleur de base de chaque pastille pour un
 * effet lisse et "metal" sans assourdir la couleur elle-meme — un premier
 * jeu de tons plus sourds (amethyste, acier, emeraude...) rendait les
 * couleurs difficiles a distinguer, surtout une fois desaturees pour les
 * blocs deja envoyes (cf. plus bas). Couleurs fixes, independantes du theme
 * clair/sombre, puisqu'il s'agit d'un attribut physique du bloc.
 */
const BRILLANT = 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.75), rgba(255,255,255,0) 58%)'

const PALETTE_COULEURS = [
  { id: 'mauve', fr: 'Mauve', en: 'Purple', fond: '#9b30ff', texte: '#fff' },
  { id: 'bleu', fr: 'Bleu', en: 'Blue', fond: '#1d6fe0', texte: '#fff' },
  { id: 'vert', fr: 'Vert', en: 'Green', fond: '#16a34a', texte: '#fff' },
  { id: 'jaune', fr: 'Jaune', en: 'Yellow', fond: '#f2c200', texte: '#111' },
  { id: 'orange', fr: 'Orange', en: 'Orange', fond: '#ff7a1a', texte: '#111' },
  { id: 'rouge', fr: 'Rouge', en: 'Red', fond: '#e11d2e', texte: '#fff' },
  { id: 'noir', fr: 'Noir', en: 'Black', fond: '#242428', texte: '#fff' },
  { id: 'blanc', fr: 'Blanc', en: 'White', fond: '#e6e6e6', texte: '#111' },
] as const

/** Doit rester en phase avec `.carte-popup` dans styles.css (largeur fixe, hauteur estimee). */
const POPUP_LARGEUR = 190
const POPUP_HAUTEUR = 175

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
  envoisConnus?: (grimpeurNom: string) => Map<string, StatutEnvoi>
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
  const [largeurCarte, setLargeurCarte] = useState(640)

  // Sur un ecran tactile, un tap declenche des evenements souris simules
  // (mouseenter/mouseout compris), mais sans survol continu reel : selon le
  // navigateur, le popup pouvait se rouvrir/refermer tout seul juste apres
  // l'avoir ouvert au tap, rendant les boutons flash/reussi/echec inertes au
  // doigt. `(hover: hover)` est vrai seulement pour un pointeur qui peut
  // vraiment survoler (souris) : sur tactile on n'attache pas du tout les
  // gestionnaires de survol, et seul le clic (ouvre/deplace le popup) et le
  // clic sur le fond (ferme) pilotent l'affichage.
  const [survolPossible] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
  )

  // Sur un petit ecran, la carte elle-meme retrecit (elle occupe toute la
  // largeur, sans les marges d'un bureau) : les pastilles a taille fixe s'y
  // chevauchaient. RAYON suit donc la largeur reelle de la carte plutot
  // qu'un seuil sur la fenetre, pour rester coherent si la carte est plus
  // etroite que l'ecran (barre laterale, fenetre partagee...). Mesure au
  // redimensionnement de la fenetre plutot que via ResizeObserver : les
  // navigateurs limitent ou retardent les callbacks de ResizeObserver sur un
  // onglet qui n'a pas le focus, ce qui aurait laisse la carte a sa taille
  // par defaut le temps que l'onglet redevienne actif.
  useLayoutEffect(() => {
    const mesurer = () => {
      if (zoneRef.current) setLargeurCarte(zoneRef.current.getBoundingClientRect().width)
    }
    mesurer()
    window.addEventListener('resize', mesurer)
    return () => window.removeEventListener('resize', mesurer)
  }, [carte])

  // Echelle continue plutot qu'un seuil unique : les positions des blocs
  // (x/y en fractions 0-1) retrecissent avec la carte, donc l'espacement
  // entre pastilles retrecit dans la meme proportion. Un simple "plus petit
  // sous 420px" gardait des pastilles proportionnellement plus grosses (donc
  // plus serrees) que sur bureau. 20px a ~1150px de large (repere bureau) ->
  // ~1,8 % de la largeur ; on garde ce ratio. Plancher a 5 (pas 8, retour de
  // Raphael sur telephone : un plancher trop haut annule l'echelle
  // proportionnelle justement sur les cartes les plus etroites, la ou elle
  // compte le plus) — la legende (V-grade) reste lisible via son propre
  // minimum de police, decouple de RAYON.
  const RAYON = Math.round(Math.max(5, Math.min(20, largeurCarte * 0.018)))
  // L'anneau "envoye" doit rester visiblement separe de la pastille a toute
  // taille : un ecart/epaisseur fixes en pixels (2px avant) restaient bien
  // en dessous de RAYON sur bureau, mais au plancher de RAYON (5px) sur
  // telephone ils ne laissaient quasiment plus de marge — la pastille
  // semblait deborder de l'anneau. Les deux suivent donc RAYON.
  const EPAISSEUR_ANNEAU = Math.max(1, Math.round(RAYON * 0.12))
  const ECART_ANNEAU = Math.max(2, Math.round(RAYON * 0.2))

  const coteParId = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of resultatMelange?.blocs ?? []) m.set(b.id, b.rating)
    return m
  }, [resultatMelange])

  // Coherent avec le reste du jeu de donnees : un bloc deja reussi par ce
  // grimpeur (fichier + Carte confondus) se montre envoye sans qu'il ait
  // besoin de re-cliquer quoi que ce soit.
  const envoisReels = useMemo(
    () => envoisConnus?.(grimpeurChoisi) ?? new Map<string, StatutEnvoi>(),
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
    if (!accesComplet) {
      // Clic sur le fond de carte (pas un bloc) : referme le popup ouvert au clic.
      setSurvole(null)
      return
    }
    if (glisse.current) return
    setSurvole(null)
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

  // Ouvre le popup flash/reussi/echec au clic (plutot qu'au seul survol) :
  // necessaire des qu'il n'y a pas de souris pour survoler, par ex. sur une
  // tablette en salle. Toujours "ouvre" plutot que "bascule" : le clic suit
  // en pratique un survol qui a deja mis `survole` a cet id, un bascule le
  // refermerait aussitot.
  //
  // Le popup ne se ferme PAS en quittant la pastille au survol (pas de
  // onMouseLeave) : entre la pastille et le popup se trouve quelques pixels
  // de fond de carte qui n'appartiennent a aucun des deux — les traverser en
  // ligne droite pour atteindre les boutons y ferait perdre le survol et
  // refermerait le popup avant d'avoir pu cliquer. Le popup reste donc
  // ouvert jusqu'a survoler un autre bloc (qui prend sa place) ou cliquer le
  // fond de la carte (cf. `ajouter`).
  const ouvrirPopup = (id: string) => {
    setSurvole(id)
  }

  const enregistrer = (id: string, type: TypeEnvoi) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!enregistrerAscension || !grimpeurValide) return
    enregistrerAscension(id, grimpeurChoisi, type)
  }

  const debuterGlisse = (id: string) => (e: React.MouseEvent) => {
    // Shift+clic sert a ouvrir le popup flash/reussi/echec en vue complete
    // (le clic seul deplace/selectionne le bloc) : pas de glisse dans ce cas.
    if (!accesComplet || e.shiftKey) return
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

  const envoyes = carte.blocs.filter((b) => {
    const s = envoisReels.get(b.id)
    return s === 'flash' || s === 'reussi' || suivi[b.id]
  }).length

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
      {resultatMelange && <LegendeCote />}

      <Carte
        titre={t('Carte des blocs', 'Boulder map')}
        sousTitre={
          accesComplet
            ? t(
                "Cliquer sur la carte pour ajouter un bloc. Cliquer un bloc existant pour le modifier, ou le glisser pour le repositionner. Majuscule (shift) + clic sur un bloc pour l'enregistrer en flash, réussi ou échec.",
                "Click the map to add a boulder. Click an existing boulder to edit it, or drag it to reposition. Shift + click a boulder to log it as a flash, a send or a fail."
              )
            : t(
                "Survolez ou cliquez un bloc pour l'enregistrer en flash, réussi ou échec.",
                'Hover or click a boulder to log it as a flash, a send or a fail.'
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
              const statut = envoisReels.get(b.id)
              const fait = statut === 'flash' || statut === 'reussi' || !!suivi[b.id]
              const nonEssaye = statut === undefined && !suivi[b.id]
              const couleur = infoCouleur(b.couleur)
              const cote = coteParId.get(b.id)
              return (
                <div
                  key={b.id}
                  style={{ position: 'absolute', left: `${b.x * 100}%`, top: `${b.y * 100}%` }}
                  onMouseEnter={survolPossible ? () => setSurvole(b.id) : undefined}
                  onMouseLeave={survolPossible ? () => setSurvole((s) => (s === b.id ? null : s)) : undefined}
                >
                  <div
                    onMouseDown={debuterGlisse(b.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (accesComplet) {
                        if (e.shiftKey) ouvrirPopup(b.id)
                        else setSelection(b.id)
                      } else if (enregistrerAscension) {
                        ouvrirPopup(b.id)
                      } else {
                        basculerEnvoye(b.id)
                      }
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
                      fontSize: Math.max(7, Math.round(RAYON * 0.6)),
                      fontWeight: 700,
                      textShadow: couleur.texte === '#fff' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                      cursor: accesComplet ? 'grab' : 'pointer',
                      touchAction: 'manipulation',
                      opacity: fait ? 0.85 : 1,
                      filter: fait ? 'grayscale(0.4) saturate(0.7)' : undefined,
                    }}
                  >
                    {b.cotation.replace(/^V/i, '')}
                    {fait && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: -(ECART_ANNEAU + EPAISSEUR_ANNEAU),
                          borderRadius: '50%',
                          border: `${EPAISSEUR_ANNEAU}px solid var(--bon)`,
                        }}
                      />
                    )}
                    {nonEssaye && (
                      // Empiete sur la pastille (inset a 0, pas negatif comme
                      // l'anneau "envoye") plutot que de deborder autour : pas
                      // d'agrandissement de son empreinte sur la carte. Inset a
                      // 0 pile, pas une valeur positive : sinon un fin bord de
                      // la pastille depasse quand meme le cercle par-dessous.
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          border: '2px solid rgba(12, 163, 12, 0.6)',
                        }}
                      />
                    )}
                  </div>

                  {survole === b.id && (() => {
                    // Colle le popup contre la pastille (aucun ecart, meme un
                    // leger chevauchement) plutot que de le decaler de
                    // quelques pixels : le moindre ecart cree une zone de fond
                    // de carte qui n'appartient ni a l'un ni a l'autre, et la
                    // traverser en diagonale pour atteindre les boutons (plus
                    // bas que la pastille) fermerait le popup avant d'y
                    // arriver, meme avec un pont limite a la hauteur de la
                    // pastille. Popup et pastille partagent le meme point haut
                    // par defaut : des que x depasse le bord de la pastille,
                    // on est dans le popup, quel que soit y tant qu'on reste
                    // dans sa hauteur.
                    //
                    // Position absolue (relative a la pastille, donc a la
                    // carte), pas fixe (relative a la fenetre) : un popup fixe
                    // ignore le pinch-zoom tactile sur mobile — sa taille en
                    // pixels CSS ne change pas avec le zoom, mais la fenetre
                    // visible, elle, retrecit d'autant, si bien qu'il finit par
                    // deborder largement de l'ecran. En absolu, le popup fait
                    // partie du contenu zoome comme le reste de la carte, donc
                    // il zoome avec elle. La contrepartie du fixed (echapper au
                    // `overflow: hidden` de la zone de carte) est traitee ici en
                    // bornant sa position dans les limites de la carte plutot
                    // qu'en sortant de son flux.
                    const largeurZone = zoneRect?.width ?? 0
                    const hauteurZone = zoneRect?.height ?? 0
                    const bx = b.x * largeurZone
                    const by = b.y * hauteurZone
                    const aGauche = bx + RAYON - 2 + POPUP_LARGEUR > largeurZone
                    const gauche = aGauche ? -(RAYON - 2 + POPUP_LARGEUR) : RAYON - 2
                    const hautMax = Math.max(4, hauteurZone - POPUP_HAUTEUR - 4)
                    const hautVoulu = by - RAYON
                    const haut = Math.min(Math.max(4, hautVoulu), hautMax) - by
                    return (
                    <div
                      className="carte-popup"
                      style={{
                        left: gauche,
                        top: haut,
                      }}
                    >
                      <div className="t">{b.nom || b.cotation}</div>
                      <div className="l">
                        <span>{t('Statut', 'Status')}</span>
                        <b
                          style={{
                            color:
                              statut === 'flash' || statut === 'reussi'
                                ? 'var(--bon)'
                                : statut === 'echec'
                                  ? 'var(--critique)'
                                  : 'var(--encre-3)',
                          }}
                        >
                          {statut === 'flash'
                            ? t('Flash ⚡', 'Flash ⚡')
                            : statut === 'reussi'
                              ? t('Réussi ✓', 'Sent ✓')
                              : statut === 'echec'
                                ? t('Échoué', 'Failed')
                                : t('Jamais essayé', 'Not attempted yet')}
                        </b>
                      </div>
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
                      {!actionsActives && (
                        // `title` ne s'affiche jamais au toucher (pas de survol sur
                        // tactile) : sans ce texte visible, les boutons desactives
                        // semblent juste ne pas repondre au tap.
                        <p className="carte-popup-raison">{raisonInactif}</p>
                      )}
                    </div>
                    )
                  })()}
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
