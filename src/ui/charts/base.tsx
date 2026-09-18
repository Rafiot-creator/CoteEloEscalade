import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLangue } from '../langue'

/**
 * Briques de graphique. Pas de librairie : les graphes du site sont peu
 * nombreux mais tenus (marques fines, grille en cheveu, aucune valeur
 * imprimee sur chaque point), ce qui est plus simple a obtenir en dessinant
 * le SVG qu'en negociant avec les reglages par defaut d'une librairie.
 */

export const MARGE = { haut: 14, droite: 18, bas: 34, gauche: 46 }

export type Echelle = (v: number) => number

export function echelleLin(d0: number, d1: number, p0: number, p1: number): Echelle {
  const etendue = d1 - d0 || 1
  return (v) => p0 + ((v - d0) / etendue) * (p1 - p0)
}

/** Graduations rondes (1 / 2 / 2,5 / 5 x 10^n) couvrant [min, max]. */
export function graduations(min: number, max: number, cible = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min]
  const brut = (max - min) / cible
  const magnitude = 10 ** Math.floor(Math.log10(brut))
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((p) => p >= brut) ?? 10 * magnitude
  const debut = Math.ceil(min / pas) * pas
  const out: number[] = []
  for (let v = debut; v <= max + pas * 1e-6; v += pas) out.push(Math.round(v / pas) * pas)
  return out
}

/** Largeur reelle du conteneur : les graphes suivent la mise en page. */
export function useLargeur<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [largeur, setLargeur] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setLargeur(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, largeur]
}

export interface ContenuInfobulle {
  titre: string
  lignes: [string, string][]
  /** Texte libre, pour expliquer plutot que d'enumerer des valeurs. */
  texte?: string
}

export function useInfobulle() {
  const [etat, setEtat] = useState<{ x: number; y: number; contenu: ContenuInfobulle } | null>(null)
  const montrer = useCallback((e: { clientX: number; clientY: number }, contenu: ContenuInfobulle) => {
    setEtat({ x: e.clientX, y: e.clientY, contenu })
  }, [])
  const cacher = useCallback(() => setEtat(null), [])

  const noeud = etat ? (
    <div
      className="infobulle"
      style={{
        left: Math.min(etat.x + 14, window.innerWidth - 256),
        top: Math.max(8, etat.y - 12),
      }}
    >
      <div className="t">{etat.contenu.titre}</div>
      {etat.contenu.texte && <div className="d">{etat.contenu.texte}</div>}
      {etat.contenu.lignes.map(([k, v]) => (
        <div className="l" key={k}>
          <span>{k}</span>
          <b>{v}</b>
        </div>
      ))}
    </div>
  ) : null

  return { montrer, cacher, noeud }
}

/** Grille horizontale + axes, communs a tous les graphes. */
export function Cadre({
  largeur,
  hauteur,
  ticksY,
  y,
  ticksX,
  x,
  formatY,
  formatX,
  titreY,
  droite = MARGE.droite,
}: {
  largeur: number
  hauteur: number
  ticksY: number[]
  y: Echelle
  ticksX: number[]
  x: Echelle
  formatY: (v: number) => string
  formatX: (v: number) => string
  titreY?: string
  /** Marge droite reelle : plus large quand des etiquettes suivent les courbes. */
  droite?: number
}) {
  return (
    <g>
      {ticksY.map((t) => (
        <g key={t}>
          <line x1={MARGE.gauche} x2={largeur - droite} y1={y(t)} y2={y(t)} stroke="var(--grille)" strokeWidth={1} />
          <text className="axe-texte" x={MARGE.gauche - 7} y={y(t)} textAnchor="end" dominantBaseline="middle">
            {formatY(t)}
          </text>
        </g>
      ))}
      <line
        x1={MARGE.gauche}
        x2={largeur - droite}
        y1={hauteur - MARGE.bas}
        y2={hauteur - MARGE.bas}
        stroke="var(--axe)"
        strokeWidth={1}
      />
      {ticksX.map((t) => (
        <text
          key={t}
          className="axe-texte"
          x={x(t)}
          y={hauteur - MARGE.bas + 15}
          textAnchor="middle"
          dominantBaseline="hanging"
        >
          {formatX(t)}
        </text>
      ))}
      {titreY && (
        <text className="axe-texte" x={MARGE.gauche} y={MARGE.haut - 6} textAnchor="start">
          {titreY}
        </text>
      )}
    </g>
  )
}

/** Bascule graphique / tableau : tout graphe a son equivalent lisible. */
export function BasculeVue({ tableau, setTableau }: { tableau: boolean; setTableau: (v: boolean) => void }) {
  const { t } = useLangue()
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      <button className="bouton" aria-pressed={!tableau} onClick={() => setTableau(false)}>
        {t('Graphe', 'Chart')}
      </button>
      <button className="bouton" aria-pressed={tableau} onClick={() => setTableau(true)}>
        {t('Tableau', 'Table')}
      </button>
    </div>
  )
}

export function Legende({ items }: { items: { couleur: string; label: string }[] }) {
  return (
    <div className="legende">
      {items.map((i) => (
        <span key={i.label}>
          <i className="pastille" style={{ background: i.couleur }} /> {i.label}
        </span>
      ))}
    </div>
  )
}

export function Enveloppe({ children }: { children: (largeur: number) => ReactNode }) {
  const [ref, largeur] = useLargeur<HTMLDivElement>()
  return <div ref={ref}>{children(largeur)}</div>
}
