import { useState } from 'react'
import type { Compte } from '../compte'
import { useLangue } from '../langue'

/** Libelle du bouton de l'en-tete, selon l'etat du compte. */
export function libelleCompte(compte: Compte, t: (fr: string, en: string) => string): string {
  if (compte.grimpeur) return compte.grimpeur.nom
  if (compte.courriel) return t('Choisir un pseudonyme', 'Pick a username')
  return t('Se connecter', 'Sign in')
}

/**
 * Panneau de connexion, sous l'en-tete : courriel -> lien recu par courriel
 * -> pseudonyme (premiere connexion seulement) -> connecte.
 */
export function PanneauCompte({ compte, apresProfil }: { compte: Compte; apresProfil: () => void }) {
  const { t } = useLangue()
  const [courriel, setCourriel] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [envoye, setEnvoye] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const agir = async (action: () => Promise<string | null>, succes: () => void) => {
    setOccupe(true)
    setErreur(null)
    const e = await action()
    setOccupe(false)
    if (e) setErreur(e)
    else succes()
  }

  return (
    <div className="large">
      <div className="carte">
        {compte.grimpeur ? (
          <>
            <h2>{t(`Connecté : ${compte.grimpeur.nom}`, `Signed in: ${compte.grimpeur.nom}`)}</h2>
            <p className="sous-titre">
              {t(
                `Compte ${compte.courriel ?? ''}. Vos envois sur la Carte sont enregistrés dans la base, à ce pseudonyme. Votre courriel n'est jamais affiché.`,
                `Account ${compte.courriel ?? ''}. Your sends on the Map are saved in the database under this username. Your email is never shown.`
              )}
            </p>
            <button className="bouton" onClick={() => void compte.deconnecter()}>
              {t('Se déconnecter', 'Sign out')}
            </button>
          </>
        ) : compte.courriel ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void agir(() => compte.creerProfil(pseudo), apresProfil)
            }}
          >
            <h2>{t('Choisissez un pseudonyme', 'Pick a username')}</h2>
            <p className="sous-titre">
              {t(
                "C'est le nom qui apparaîtra dans les classements, visible par tous. Votre courriel ne l'est jamais. De 2 à 30 caractères ; il ne pourra pas être changé pour l'instant.",
                "This is the name shown in the rankings, visible to everyone. Your email never is. 2 to 30 characters; it can't be changed for now."
              )}
            </p>
            <div className="barre-outils">
              <input
                type="text"
                value={pseudo}
                onChange={(e) => setPseudo(e.currentTarget.value)}
                maxLength={30}
                placeholder={t('pseudonyme', 'username')}
                style={{ width: 220 }}
                autoFocus
              />
              <button className="bouton" type="submit" disabled={occupe || pseudo.trim().length < 2}>
                {t('Valider', 'Confirm')}
              </button>
              <button className="bouton discret" type="button" onClick={() => void compte.deconnecter()}>
                {t('Se déconnecter', 'Sign out')}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void agir(() => compte.envoyerLien(courriel), () => setEnvoye(courriel.trim()))
            }}
          >
            <h2>{t('Se connecter', 'Sign in')}</h2>
            <p className="sous-titre">
              {envoye
                ? t(
                    `Lien envoyé à ${envoye}. Ouvrez-le sur cet appareil-ci : vous y resterez connecté.`,
                    `Link sent to ${envoye}. Open it on this device: you'll stay signed in here.`
                  )
                : t(
                    'Recevez un lien de connexion par courriel, sans mot de passe. Une seule fois par appareil : vous restez connecté ensuite.',
                    'Get a sign-in link by email, no password. Once per device: you stay signed in afterwards.'
                  )}
            </p>
            <div className="barre-outils">
              <input
                type="email"
                value={courriel}
                onChange={(e) => setCourriel(e.currentTarget.value)}
                placeholder={t('votre courriel', 'your email')}
                style={{ width: 260 }}
                required
              />
              <button className="bouton" type="submit" disabled={occupe}>
                {envoye ? t('Renvoyer le lien', 'Send again') : t('Recevoir le lien', 'Send me the link')}
              </button>
            </div>
          </form>
        )}
        {erreur && (
          <p className="sous-titre" style={{ color: 'var(--critique)', marginTop: 8 }}>
            {erreur}
          </p>
        )}
      </div>
    </div>
  )
}
