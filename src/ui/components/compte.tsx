import { useState } from 'react'
import type { Compte } from '../compte'
import { useLangue } from '../langue'
import { BoutonGoogle } from './BoutonGoogle'

/** Libelle du bouton de l'en-tete, selon l'etat du compte. */
export function libelleCompte(compte: Compte, t: (fr: string, en: string) => string): string {
  if (compte.grimpeur) return compte.grimpeur.nom
  if (compte.courriel) return t('Choisir un pseudonyme', 'Pick a username')
  return t('Se connecter', 'Sign in')
}

/**
 * Panneau de connexion, sous l'en-tete : Google, ou courriel et mot de passe
 * -> pseudonyme (premiere connexion seulement) -> connecte. Sert aussi a
 * choisir un nouveau mot de passe au retour du lien « mot de passe oublie ».
 */
export function PanneauCompte({ compte, apresProfil }: { compte: Compte; apresProfil: () => void }) {
  const { t } = useLangue()
  const [courriel, setCourriel] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'oubli'>('connexion')
  const [pseudo, setPseudo] = useState('')
  // Message de reussite (courriel envoye, mot de passe change...).
  const [info, setInfo] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)
  // Le bouton de Google n'a pas pu charger : bouton de secours par redirection.
  const [secoursGoogle, setSecoursGoogle] = useState(false)

  const changerMode = (m: typeof mode) => {
    setMode(m)
    setErreur(null)
    setInfo(null)
  }

  const soumettre = () => {
    if (mode === 'connexion') void agir(() => compte.connecter(courriel, motDePasse), () => {})
    else if (mode === 'oubli')
      void agir(
        () => compte.oublie(courriel),
        () =>
          setInfo(
            t(
              `Si un compte existe pour ${courriel.trim()}, un lien pour choisir un nouveau mot de passe vient d'y être envoyé.`,
              `If an account exists for ${courriel.trim()}, a link to choose a new password has just been sent to it.`
            )
          )
      )
    else
      void agir(
        async () => {
          const r = await compte.inscrire(courriel, motDePasse)
          if (r.confirmer)
            setInfo(
              t(
                `Compte créé. Ouvrez le lien envoyé à ${courriel.trim()} pour confirmer l'adresse, puis connectez-vous.`,
                `Account created. Open the link sent to ${courriel.trim()} to confirm the address, then sign in.`
              )
            )
          return r.erreur
        },
        () => {}
      )
  }

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
        {compte.recuperation ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void agir(
                () => compte.changerMotDePasse(motDePasse),
                () => setInfo(t('Mot de passe changé.', 'Password changed.'))
              )
            }}
          >
            <h2>{t('Nouveau mot de passe', 'New password')}</h2>
            <p className="sous-titre">{t('Au moins 6 caractères.', 'At least 6 characters.')}</p>
            <div className="barre-outils">
              <input
                type="password"
                autoComplete="new-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.currentTarget.value)}
                placeholder={t('nouveau mot de passe', 'new password')}
                style={{ width: 220 }}
                minLength={6}
                required
                autoFocus
              />
              <button className="bouton" type="submit" disabled={occupe}>
                {t('Enregistrer', 'Save')}
              </button>
            </div>
          </form>
        ) : compte.grimpeur ? (
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
          <>
            <h2>
              {mode === 'inscription'
                ? t('Créer un compte', 'Create an account')
                : mode === 'oubli'
                  ? t('Mot de passe oublié', 'Forgot password')
                  : t('Se connecter', 'Sign in')}
            </h2>
            <p className="sous-titre">
              {t(
                'Vous restez connecté sur cet appareil. Votre courriel n\'est jamais affiché : seul votre pseudonyme l\'est.',
                'You stay signed in on this device. Your email is never shown: only your username is.'
              )}{' '}
              <a href={t('confidentialite.html', 'confidentialite.html#en')} target="_blank" rel="noreferrer">
                {t('Confidentialité', 'Privacy')}
              </a>
            </p>
            {mode !== 'oubli' && (
              <>
                <div className="barre-outils">
                  {secoursGoogle ? (
                    <button className="bouton" type="button" disabled={occupe} onClick={() => void agir(compte.connecterGoogle, () => {})}>
                      {t('Continuer avec Google', 'Continue with Google')}
                    </button>
                  ) : (
                    <BoutonGoogle
                      surJeton={(jeton, nonce) => void agir(() => compte.connecterJetonGoogle(jeton, nonce), () => {})}
                      surEchec={() => setSecoursGoogle(true)}
                    />
                  )}
                </div>
                <p className="discret" style={{ margin: '10px 0 6px', fontSize: 13 }}>
                  {t('ou avec votre courriel :', 'or with your email:')}
                </p>
              </>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                soumettre()
              }}
            >
              <div className="barre-outils">
                <input
                  type="email"
                  autoComplete="email"
                  value={courriel}
                  onChange={(e) => setCourriel(e.currentTarget.value)}
                  placeholder={t('courriel', 'email')}
                  style={{ width: 240 }}
                  required
                />
                {mode !== 'oubli' && (
                  <input
                    type="password"
                    autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
                    value={motDePasse}
                    onChange={(e) => setMotDePasse(e.currentTarget.value)}
                    placeholder={mode === 'inscription' ? t('mot de passe (6 caractères ou plus)', 'password (6+ characters)') : t('mot de passe', 'password')}
                    style={{ width: 240 }}
                    minLength={mode === 'inscription' ? 6 : undefined}
                    required
                  />
                )}
                <button className="bouton" type="submit" disabled={occupe}>
                  {mode === 'inscription'
                    ? t('Créer le compte', 'Create account')
                    : mode === 'oubli'
                      ? t('Recevoir un lien', 'Send me a link')
                      : t('Se connecter', 'Sign in')}
                </button>
              </div>
            </form>
            <div className="barre-outils" style={{ marginTop: 8, fontSize: 13 }}>
              {mode !== 'connexion' && (
                <button className="lien-bloc" type="button" onClick={() => changerMode('connexion')}>
                  {t('J\'ai déjà un compte', 'I already have an account')}
                </button>
              )}
              {mode !== 'inscription' && (
                <button className="lien-bloc" type="button" onClick={() => changerMode('inscription')}>
                  {t('Créer un compte', 'Create an account')}
                </button>
              )}
              {mode === 'connexion' && (
                <button className="lien-bloc" type="button" onClick={() => changerMode('oubli')}>
                  {t('Mot de passe oublié ?', 'Forgot password?')}
                </button>
              )}
            </div>
          </>
        )}
        {info && (
          <p className="sous-titre" style={{ color: 'var(--bon)', marginTop: 8 }}>
            {info}
          </p>
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
