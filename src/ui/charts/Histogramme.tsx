import { nombre, signe } from '../format'
import { useLangue } from '../langue'
import { Cadre, Enveloppe, MARGE, echelleLin, graduations, useInfobulle } from './base'

/** Espace en couleur de fond entre deux barres voisines. */
const ECART_BARRES = 2
const RAYON = 4

/**
 * Distribution d'une grandeur continue en classes.
 * Une seule serie : pas de legende, le titre de la carte dit ce qui est trace.
 */
export function Histogramme({
  valeurs,
  largeurClasse = 0.5,
  hauteur = 220,
  uniteX,
  uniteY,
  couleur = 'var(--serie-1)',
  formatX = (v, decimales) => signe(v, decimales),
}: {
  valeurs: number[]
  largeurClasse?: number
  hauteur?: number
  uniteX?: string
  uniteY?: string
  couleur?: string
  /**
   * Etiquette d'une valeur de l'axe X (graduations et infobulle). Par defaut un
   * ecart signe (+0,5) ; l'ecran Grimpeurs, qui trace des niveaux, met « V7 ».
   */
  formatX?: (v: number, decimales: number) => string
}) {
  const { montrer, cacher, noeud } = useInfobulle()
  const { t } = useLangue()
  const unite = uniteX ?? t('cote', 'grade')
  const uniteEffectif = uniteY ?? t('blocs', 'boulders')

  return (
    <Enveloppe>
      {(largeur) => {
        if (!valeurs.length) return <p className="vide">{t('Aucune donnée.', 'No data.')}</p>

        const min = Math.floor(Math.min(...valeurs) / largeurClasse) * largeurClasse
        const max = Math.ceil(Math.max(...valeurs) / largeurClasse) * largeurClasse
        const nbClasses = Math.max(1, Math.round((max - min) / largeurClasse))
        const classes = new Array(nbClasses).fill(0)
        for (const v of valeurs) {
          const i = Math.min(nbClasses - 1, Math.floor((v - min) / largeurClasse))
          classes[i] += 1
        }

        const maxEffectif = Math.max(...classes)
        const x = echelleLin(min, max, MARGE.gauche, largeur - MARGE.droite)
        const y = echelleLin(0, maxEffectif, hauteur - MARGE.bas, MARGE.haut)
        const largeurBarre = Math.max(1, (x(min + largeurClasse) - x(min)) - ECART_BARRES)

        return (
          <>
            <svg width={largeur} height={hauteur} role="img" aria-label={t('Distribution', 'Distribution')}>
              <Cadre
                largeur={largeur}
                hauteur={hauteur}
                // Des effectifs : graduations entieres seulement. Avec peu de
                // valeurs (2 grimpeurs), le pas tombait a 0,25 et les
                // etiquettes arrondies se repetaient (0, 0, 1, 1, 1).
                ticksY={graduations(0, maxEffectif, Math.min(4, maxEffectif)).filter(Number.isInteger)}
                y={y}
                ticksX={graduations(min, max, 6)}
                x={x}
                formatY={(v) => nombre(v)}
                // Une decimale seulement pour les demi-cotes : sans ca, 7,5
                // s'affichait arrondi a 8, a cote du vrai 8.
                formatX={(v) => formatX(v, Number.isInteger(v) ? 0 : 1)}
                titreY={uniteEffectif}
              />

              {classes.map((n, i) => {
                const x0 = x(min + i * largeurClasse) + ECART_BARRES / 2
                const hauteurBarre = hauteur - MARGE.bas - y(n)
                return (
                  <g key={i}>
                    {n > 0 && (
                      <path
                        d={arrondiHaut(x0, y(n), largeurBarre, hauteurBarre, RAYON)}
                        fill={couleur}
                      />
                    )}
                    <rect
                      x={x0}
                      y={MARGE.haut}
                      width={largeurBarre}
                      height={hauteur - MARGE.bas - MARGE.haut}
                      fill="transparent"
                      onMouseMove={(e) =>
                        montrer(e, {
                          titre: t(
                            `${formatX(min + i * largeurClasse, 1)} à ${formatX(min + (i + 1) * largeurClasse, 1)} ${unite}`.trim(),
                            `${formatX(min + i * largeurClasse, 1)} to ${formatX(min + (i + 1) * largeurClasse, 1)} ${unite}`.trim()
                          ),
                          lignes: [[uniteEffectif[0].toUpperCase() + uniteEffectif.slice(1), nombre(n)]],
                        })
                      }
                      onMouseLeave={cacher}
                    />
                  </g>
                )
              })}

              {/* Reference : accord parfait entre calcul et cotation officielle. */}
              {min < 0 && max > 0 && (
                <line x1={x(0)} x2={x(0)} y1={MARGE.haut} y2={hauteur - MARGE.bas} stroke="var(--axe)" strokeWidth={1} />
              )}
            </svg>
            {noeud}
          </>
        )
      }}
    </Enveloppe>
  )
}

/** Barre a extremite arrondie cote donnee, carree sur la ligne de base. */
function arrondiHaut(x: number, y: number, l: number, h: number, r: number): string {
  const rr = Math.min(r, l / 2, h)
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + l - rr},${y} Q${x + l},${y} ${x + l},${y + rr} L${x + l},${y + h} Z`
}
