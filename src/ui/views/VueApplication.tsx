import { useState } from 'react'
import { Carte } from '../components/base'
import { useInstallation, type Plateforme } from '../installation'
import { useLangue } from '../langue'

/**
 * Onglet Telecharger : installer le site comme une application (PWA). Un vrai
 * bouton quand le navigateur le permet (Chrome, Edge, Android), sinon les
 * instructions de l'appareil detecte (Safari, sur iPhone, n'offre que le menu
 * Partager). L'onglet disparait une fois ouvert depuis l'application (App.tsx).
 */
export function VueApplication() {
  const { t } = useLangue()
  const installation = useInstallation()
  const [refusee, setRefusee] = useState(false)

  const instructions = (p: Plateforme) => {
    if (p === 'ios')
      return (
        <ol>
          <li>{t('Ouvrez ce site dans Safari.', 'Open this site in Safari.')}</li>
          <li>
            {t(
              'Touchez le bouton Partager (le carré avec une flèche vers le haut, parfois dans le menu « ⋯ »).',
              'Tap the Share button (the square with an upward arrow, sometimes inside the "⋯" menu).'
            )}
          </li>
          <li>{t('Choisissez « Sur l\'écran d\'accueil », puis « Ajouter ».', 'Choose "Add to Home Screen", then "Add".')}</li>
        </ol>
      )
    if (p === 'android')
      return (
        <ol>
          <li>{t('Ouvrez ce site dans Chrome.', 'Open this site in Chrome.')}</li>
          <li>{t('Touchez le menu ⋮ en haut à droite.', 'Tap the ⋮ menu at the top right.')}</li>
          <li>
            {t(
              'Choisissez « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».',
              'Choose "Install app" or "Add to Home screen".'
            )}
          </li>
        </ol>
      )
    return (
      <ul>
        <li>
          {t(
            'Chrome ou Edge : icône d\'installation à droite de la barre d\'adresse, ou menu ⋮ puis « Installer Cote Elo Escalade ».',
            'Chrome or Edge: install icon at the right of the address bar, or ⋮ menu then "Install Cote Elo Escalade".'
          )}
        </li>
        <li>{t('Safari sur Mac : menu Fichier, puis « Ajouter au Dock ».', 'Safari on Mac: File menu, then "Add to Dock".')}</li>
      </ul>
    )
  }

  const autres = (['ios', 'android', 'ordinateur'] as const).filter((p) => p !== installation.plateforme)
  const nom = (p: Plateforme) =>
    p === 'ios' ? 'iPhone / iPad' : p === 'android' ? 'Android' : t('Ordinateur', 'Computer')

  return (
    <div className="large">
      <Carte
        titre={t("Télécharger l'application", 'Get the app')}
        sousTitre={t(
          "Le site s'installe comme une application : une icône sur l'écran d'accueil, une ouverture en plein écran. Gratuit, sans passer par l'App Store ni Google Play.",
          'The site installs like an app: an icon on your home screen, opening full screen. Free, no App Store or Google Play needed.'
        )}
      >
        <div style={{ maxWidth: 640 }}>
          {installation.installee ? (
            <p>
              <strong>{t("C'est fait !", 'Done!')}</strong>{' '}
              {t(
                "L'application « Cote Elo » est sur votre écran d'accueil.",
                'The "Cote Elo" app is on your home screen.'
              )}
            </p>
          ) : installation.installer && !refusee ? (
            <button
              className="bouton"
              style={{ fontSize: '1.1em', padding: '10px 20px', background: 'var(--bon)', color: '#fff', borderColor: 'var(--bon)' }}
              onClick={async () => {
                const ok = await installation.installer?.()
                if (!ok) setRefusee(true)
              }}
            >
              {t("Installer l'application", 'Install the app')}
            </button>
          ) : (
            <>
              <p>
                <strong>{t('Pour l\'installer', 'To install it')}</strong> ({nom(installation.plateforme)}) :
              </p>
              {instructions(installation.plateforme)}
            </>
          )}

          <details style={{ marginTop: 16 }}>
            <summary>{t('Sur un autre appareil', 'On another device')}</summary>
            {autres.map((p) => (
              <div key={p}>
                <p style={{ marginBottom: 0 }}>
                  <strong>{nom(p)}</strong>
                </p>
                {instructions(p)}
              </div>
            ))}
          </details>

          <p className="sous-titre" style={{ marginTop: 16 }}>
            {t(
              "C'est le même site : même compte, mêmes cotes, envois en temps réel. Une mise à jour du site met l'application à jour. Sur iPhone, il faudra vous reconnecter une fois dans l'application.",
              "It's the same site: same account, same grades, real-time sends. Updating the site updates the app. On iPhone, you'll need to sign in once inside the app."
            )}
          </p>
        </div>
      </Carte>
    </div>
  )
}
