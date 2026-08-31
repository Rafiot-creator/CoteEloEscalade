import { COTATIONS } from '../../core/cotations'
import { nombre, signe } from '../format'
import { Cadre, Enveloppe, MARGE, echelleLin, graduations, useInfobulle } from './base'

export interface PointNuage {
  cle: string
  nom: string
  /** Salle, secteur, couleur : de quoi identifier le bloc sur le mur. */
  lieu: string
  /** Index de la cotation affichee par l'ouvreur (entier). */
  x: number
  /** Index de la cotation calculee (continu). */
  y: number
  ecart: number
  matchs: number
  cotationOfficielle: string
  cotationCalculee: string
}

/** Ecart, en crans V, au-dela duquel la couleur est saturee. */
const ECART_MAX = 2

/**
 * Couleur divergente : bleu = plus facile que sa cotation, rouge = plus dure,
 * gris neutre au milieu. `color-mix` laisse le navigateur interpoler dans les
 * jetons du theme courant — la palette suit donc le mode clair/sombre sans
 * qu'on duplique les valeurs ici.
 */
function couleurEcart(ecart: number): string {
  const t = Math.min(1, Math.abs(ecart) / ECART_MAX)
  const pole = ecart >= 0 ? 'var(--div-chaud)' : 'var(--div-froid)'
  return `color-mix(in oklab, ${pole} ${Math.round(t * 100)}%, var(--div-milieu))`
}

/** Deplacement horizontal deterministe : les cotations affichees sont des
 *  entiers, sans quoi des dizaines de blocs se superposeraient exactement. */
function decalage(cle: string): number {
  let h = 0
  for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) | 0
  return ((h % 1000) / 1000 - 0.5) * 0.62
}

export function Nuage({ points, hauteur = 340 }: { points: PointNuage[]; hauteur?: number }) {
  const { montrer, cacher, noeud } = useInfobulle()

  return (
    <Enveloppe>
      {(largeur) => {
        if (!points.length) return <p className="vide">Aucun bloc a afficher.</p>

        const xs = points.map((p) => p.x)
        const ys = points.map((p) => p.y)
        const min = Math.floor(Math.min(...xs, ...ys)) - 0.6
        const max = Math.ceil(Math.max(...xs, ...ys)) + 0.6

        const x = echelleLin(min, max, MARGE.gauche, largeur - MARGE.droite)
        const y = echelleLin(min, max, hauteur - MARGE.bas, MARGE.haut)
        const ticks = graduations(min, max, 6)
          .map((t) => Math.round(t))
          .filter((t, i, a) => t >= 0 && t < COTATIONS.length && a.indexOf(t) === i)

        return (
          <>
            <svg width={largeur} height={hauteur} role="img" aria-label="Cotation calculee comparee a la cotation affichee">
              <Cadre
                largeur={largeur}
                hauteur={hauteur}
                ticksY={ticks}
                y={y}
                ticksX={ticks}
                x={x}
                formatY={(t) => COTATIONS[t] ?? ''}
                formatX={(t) => COTATIONS[t] ?? ''}
                titreY="calculee"
              />

              {/* Reference : sur cette ligne, le calcul confirme la cotation. */}
              <line x1={x(min)} y1={y(min)} x2={x(max)} y2={y(max)} stroke="var(--axe)" strokeWidth={1} />

              {points.map((p) => {
                const cx = x(p.x + decalage(p.cle))
                const cy = y(p.y)
                return (
                  <g key={p.cle}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4.5}
                      fill={couleurEcart(p.ecart)}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                    {/* Cible de survol confortable, independante de la taille de la marque. */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={12}
                      fill="transparent"
                      onMouseMove={(e) =>
                        montrer(e, {
                          titre: p.nom,
                          lignes: [
                            ['Ou', p.lieu],
                            ['Cotation affichee', p.cotationOfficielle],
                            ['Cotation calculee', p.cotationCalculee],
                            ['Ecart', `${signe(p.ecart)} cran V`],
                            ['Matchs comptes', nombre(p.matchs)],
                          ],
                        })
                      }
                      onMouseLeave={cacher}
                    />
                  </g>
                )
              })}
            </svg>
            <EchelleDivergente />
            {noeud}
          </>
        )
      }}
    </Enveloppe>
  )
}

function EchelleDivergente() {
  const pas = [-2, -1, 0, 1, 2]
  return (
    <div className="legende" style={{ marginTop: 6, alignItems: 'center' }}>
      <span className="discret">Plus facile qu'affiche</span>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {pas.map((e) => (
          <i
            key={e}
            className="pastille"
            style={{ background: couleurEcart(e), width: 22, height: 9, borderRadius: 2 }}
            title={`${signe(e)} cran V`}
          />
        ))}
      </span>
      <span className="discret">Plus dur</span>
    </div>
  )
}
