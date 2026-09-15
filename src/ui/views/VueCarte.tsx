import { useEffect, useMemo, useRef, useState } from 'react'
import { COTATIONS } from '../../core/cotations'
import { chargerCarte } from '../../core/cartes/sources'
import type { BlocCarte, Carte as DonneesCarte } from '../../core/cartes/types'
import { useInfobulle } from '../charts/base'
import { Carte, Tuile } from '../components/base'
import { telecharger } from '../format'
import { useLangue } from '../langue'
import { suiviLocal } from '../suivi'

/**
 * Couleur des prises, du mauve au rouge (ordre du spectre visible), puis
 * noir et blanc ajoutes aux extremes. C'est la couleur reelle choisie par
 * l'ouvreur — elle ne depend pas de la cotation.
 */
const PALETTE_COULEURS = [
  { id: 'mauve', fr: 'Mauve', en: 'Purple', fond: '#8b3fd1', texte: '#fff' },
  { id: 'bleu', fr: 'Bleu', en: 'Blue', fond: 'var(--serie-1)', texte: '#fff' },
  { id: 'vert', fr: 'Vert', en: 'Green', fond: 'var(--serie-3)', texte: '#fff' },
  { id: 'jaune', fr: 'Jaune', en: 'Yellow', fond: 'var(--serie-4)', texte: '#fff' },
  { id: 'orange', fr: 'Orange', en: 'Orange', fond: 'var(--serie-2)', texte: '#fff' },
  { id: 'rouge', fr: 'Rouge', en: 'Red', fond: 'var(--critique)', texte: '#fff' },
  { id: 'noir', fr: 'Noir', en: 'Black', fond: '#18181b', texte: '#fff' },
  { id: 'blanc', fr: 'Blanc', en: 'White', fond: '#f5f5f2', texte: '#111' },
] as const

function infoCouleur(id: string) {
  return PALETTE_COULEURS.find((c) => c.id === id) ?? PALETTE_COULEURS[1]
}

function nouvelId(): string {
  return `b${Date.now().toString(36)}${Math.round(Math.random() * 1000)}`
}

const RAYON = 20

export function VueCarte({ centreId, accesComplet }: { centreId: string; accesComplet: boolean }) {
  const { t } = useLangue()
  const [carte, setCarte] = useState<DonneesCarte | null>(null)
  const [selection, setSelection] = useState<string | null>(null)
  const [suivi, setSuivi] = useState<Record<string, boolean>>({})
  const zoneRef = useRef<HTMLDivElement>(null)
  const editionRef = useRef<HTMLDivElement>(null)
  const glisse = useRef<{ id: string; deplace: boolean } | null>(null)
  const { montrer, cacher, noeud } = useInfobulle()

  useEffect(() => {
    let vivant = true
    setCarte(null)
    setSelection(null)
    chargerCarte(centreId).then((c) => {
      if (vivant) setCarte(c)
    })
    setSuivi(suiviLocal.lire(centreId))
    return () => {
      vivant = false
    }
  }, [centreId])

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
    suiviLocal.definir(centreId, id, valeur)
    setSuivi({ ...suivi, [id]: valeur })
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

  const envoyes = carte.blocs.filter((b) => suivi[b.id]).length

  return (
    <div className="large">
      <div className="grille tuiles">
        <Tuile etiquette={t('Blocs sur la carte', 'Boulders on the map')} valeur={String(carte.blocs.length)} />
        {!accesComplet && carte.blocs.length > 0 && (
          <Tuile
            etiquette={t('Envoyés par vous', 'Sent by you')}
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
                "Cliquer un bloc pour indiquer si vous l'avez envoyé.",
                "Click a boulder to mark whether you've sent it."
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
          {carte.blocs.map((b) => {
            const fait = !!suivi[b.id]
            const couleur = infoCouleur(b.couleur)
            return (
              <div
                key={b.id}
                onMouseDown={debuterGlisse(b.id)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (accesComplet) setSelection(b.id)
                  else basculerEnvoye(b.id)
                }}
                onMouseMove={(e) =>
                  montrer(e, {
                    titre: b.nom || b.cotation,
                    lignes: [
                      [t('Cotation', 'Grade'), b.cotation],
                      [t('Couleur', 'Color'), t(couleur.fr, couleur.en)],
                      [t('Style', 'Style'), b.style || '—'],
                    ],
                  })
                }
                onMouseLeave={cacher}
                style={{
                  position: 'absolute',
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: RAYON * 2,
                  height: RAYON * 2,
                  marginLeft: -RAYON,
                  marginTop: -RAYON,
                  borderRadius: '50%',
                  background: couleur.fond,
                  boxShadow: `0 0 0 2px ${selection === b.id ? 'var(--encre)' : 'var(--bord-fort)'}, 0 1px 4px rgba(0,0,0,0.35)`,
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
            )
          })}
          {noeud}
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
                    background: c.fond,
                    cursor: 'pointer',
                    boxShadow:
                      blocSelectionne.couleur === c.id
                        ? '0 0 0 2px var(--encre), 0 0 0 4px var(--surface)'
                        : '0 0 0 2px var(--bord-fort)',
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
