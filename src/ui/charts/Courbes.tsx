import { COTATIONS } from '../../core/cotations'
import { dateCourte, mois, nombre } from '../format'
import { useLangue } from '../langue'
import { Cadre, Enveloppe, Legende, MARGE, echelleLin, graduations, useInfobulle } from './base'

export const COULEURS_SERIES = ['var(--serie-1)', 'var(--serie-2)', 'var(--serie-3)', 'var(--serie-4)']

export interface Serie {
  cle: string
  label: string
  points: { t: number; v: number }[]
}

/**
 * Courbes temporelles (progression des grimpeurs).
 *
 * Quatre series au maximum : au-dela, les teintes ne se distinguent plus de
 * facon fiable et les etiquettes de fin se chevauchent. L'ecran limite donc la
 * selection en amont plutot que de cycler les couleurs.
 */
export function Courbes({
  series,
  hauteur = 300,
  formatY = (v: number) => COTATIONS[Math.round(v)] ?? '',
}: {
  series: Serie[]
  hauteur?: number
  formatY?: (v: number) => string
}) {
  const { montrer, cacher, noeud } = useInfobulle()
  const { t } = useLangue()

  return (
    <Enveloppe>
      {(largeur) => {
        const tous = series.flatMap((s) => s.points)
        if (!tous.length) return <p className="vide">{t('Sélectionner au moins un grimpeur.', 'Select at least one climber.')}</p>

        const tMin = Math.min(...tous.map((p) => p.t))
        const tMax = Math.max(...tous.map((p) => p.t))
        const vMin = Math.min(...tous.map((p) => p.v))
        const vMax = Math.max(...tous.map((p) => p.v))
        const marge = (vMax - vMin) * 0.12 || 0.5

        // Place a droite pour les etiquettes de fin de courbe.
        const droite = 74
        const x = echelleLin(tMin, tMax, MARGE.gauche, largeur - droite)
        const y = echelleLin(vMin - marge, vMax + marge, hauteur - MARGE.bas, MARGE.haut)

        return (
          <>
            <svg width={largeur} height={hauteur} role="img" aria-label={t('Progression au fil du temps', 'Progression over time')}>
              <Cadre
                largeur={largeur}
                droite={droite}
                hauteur={hauteur}
                ticksY={graduations(vMin - marge, vMax + marge, 5)}
                y={y}
                ticksX={graduations(tMin, tMax, 5)}
                x={x}
                formatY={formatY}
                formatX={(v) => mois(v)}
                titreY={t('niveau', 'level')}
              />

              {series.map((s, i) => {
                const couleur = COULEURS_SERIES[i % COULEURS_SERIES.length]
                const d = s.points.map((p, j) => `${j ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
                const fin = s.points[s.points.length - 1]
                return (
                  <g key={s.cle}>
                    <path d={d} fill="none" stroke={couleur} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    <circle cx={x(fin.t)} cy={y(fin.v)} r={4} fill={couleur} stroke="var(--surface)" strokeWidth={2} />
                    <text className="etiquette-serie" x={x(fin.t) + 9} y={y(fin.v)} dominantBaseline="middle">
                      {formatY(fin.v)}
                    </text>
                    {s.points.map((p, j) => (
                      <circle
                        key={j}
                        cx={x(p.t)}
                        cy={y(p.v)}
                        r={9}
                        fill="transparent"
                        onMouseMove={(e) =>
                          montrer(e, {
                            titre: s.label,
                            lignes: [
                              [t('Date', 'Date'), dateCourte(p.t)],
                              [t('Niveau', 'Level'), `${formatY(p.v)} (${nombre(p.v, 1)})`],
                            ],
                          })
                        }
                        onMouseLeave={cacher}
                      />
                    ))}
                  </g>
                )
              })}
            </svg>
            {series.length > 1 && (
              <Legende
                items={series.map((s, i) => ({ couleur: COULEURS_SERIES[i % COULEURS_SERIES.length], label: s.label }))}
              />
            )}
            {noeud}
          </>
        )
      }}
    </Enveloppe>
  )
}

/** Courbe compacte, sans axes : sert a montrer une convergence. */
export function MiniCourbe({ valeurs, hauteur = 54 }: { valeurs: number[]; hauteur?: number }) {
  const { t } = useLangue()
  return (
    <Enveloppe>
      {(largeur) => {
        if (valeurs.length < 2)
          return (
            <p className="discret" style={{ fontSize: 12 }}>
              {t('Une seule passe : rien à tracer.', 'Only one pass: nothing to plot.')}
            </p>
          )
        const x = echelleLin(0, valeurs.length - 1, 2, largeur - 2)
        const y = echelleLin(0, Math.max(...valeurs), hauteur - 4, 4)
        const d = valeurs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
        return (
          <svg width={largeur} height={hauteur} role="img" aria-label={t('Déplacement moyen par passe', 'Average movement per pass')}>
            <path d={d} fill="none" stroke="var(--serie-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle
              cx={x(valeurs.length - 1)}
              cy={y(valeurs[valeurs.length - 1])}
              r={4}
              fill="var(--serie-1)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </svg>
        )
      }}
    </Enveloppe>
  )
}
