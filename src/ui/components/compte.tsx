import { useEffect, useState } from 'react'
import { etiquettesEchelle, versCotationV, type Echelle } from '../../core/echelles'
import { supabase } from '../../core/supabase'
import type { Compte } from '../compte'
import { useLangue } from '../langue'
import { BoutonGoogle } from './BoutonGoogle'

/** Libelle du bouton de l'en-tete, selon l'etat du compte. */
export function libelleCompte(compte: Compte, t: (fr: string, en: string) => string): string {
  if (compte.grimpeur) return compte.grimpeur.nom
  if (compte.courriel) return t('Choisir un pseudonyme', 'Pick a username')
  return t('Se connecter', 'Sign in')
}

const INCONNU = 'inconnu'

interface CentreInscription {
  id: string
  nom: string
  echelle: Echelle
}

/** Centres proposes comme centre principal (table `centres`, sans la Demo). */
function useCentres(): CentreInscription[] {
  const [centres, setCentres] = useState<CentreInscription[]>([])
  useEffect(() => {
    void supabase
      .from('centres')
      .select('id, nom, echelle')
      .neq('id', 'demo')
      .order('nom')
      .returns<CentreInscription[]>()
      .then(({ data }) => setCentres(data ?? []))
  }, [])
  return centres
}

const AUCUN_CENTRE = 'aucun'

/**
 * Centre ou l'on grimpe le plus souvent : preselectionne ce centre a la
 * premiere visite, et s'affiche dans la colonne « Salle » des classements.
 * `valeur` : id du centre, AUCUN_CENTRE, ou '' tant que rien n'est choisi.
 */
function ChoixCentre({ centres, valeur, onChange }: { centres: CentreInscription[]; valeur: string; onChange: (v: string) => void }) {
  const { t } = useLangue()
  return (
    <>
      <label htmlFor="choix-centre" style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
        {t('Dans quel centre grimpez-vous le plus souvent ?', 'Which gym do you climb at most often?')}
      </label>
      <select id="choix-centre" value={valeur} onChange={(e) => onChange(e.currentTarget.value)} style={{ minWidth: 220 }}>
        <option value="" disabled>
          {t('Choisir…', 'Choose…')}
        </option>
        {centres.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nom}
          </option>
        ))}
        <option value={AUCUN_CENTRE}>{t('Un autre centre', 'Another gym')}</option>
      </select>
      <p className="param-aide" style={{ margin: '4px 0 0' }}>
        {t(
          'Affiché dans les classements, à côté de votre pseudonyme. Modifiable ensuite.',
          'Shown in the rankings, next to your username. Can be changed later.'
        )}
      </p>
    </>
  )
}

/**
 * La question du niveau de flash. La cote de depart du grimpeur sera un cran
 * au-dessus (flash V4 -> depart a 5000, cf. supabase/migrations/), puisqu'une
 * cote du site est celle d'un bloc reussi une fois sur deux. « Je ne sais
 * pas » laisse la cote de depart s'estimer sur ses premiers blocs.
 */
function ChoixFlash({
  valeur,
  onChange,
  sansInconnu = false,
  echelleCentre = 'v',
}: {
  valeur: string
  onChange: (v: string) => void
  sansInconnu?: boolean
  /**
   * Echelle du centre principal : dans un centre Rose Bloc, le grimpeur peut
   * repondre en cote 1-15, convertie en V (src/core/echelles.ts). `valeur`
   * reste toujours une cote V.
   */
  echelleCentre?: Echelle
}) {
  const { t } = useLangue()
  const [echelle, setEchelle] = useState<Echelle>('v')
  const echelleAffichee = echelleCentre === 'v' ? 'v' : echelle
  const options =
    echelleAffichee === 'v'
      ? Array.from({ length: 12 }, (_, i) => ({ valeur: `V${i}`, libelle: `V${i}` }))
      : etiquettesEchelle(echelleAffichee).map((n) => ({ valeur: versCotationV(n, echelleAffichee), libelle: n }))
  const changerEchelle = (e: Echelle) => {
    setEchelle(e)
    if (valeur !== INCONNU) onChange('')
  }
  return (
    <>
      <label htmlFor="choix-flash" style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
        {t('Quelle cote flashez-vous habituellement ?', 'What grade do you usually flash?')}
      </label>
      {echelleCentre !== 'v' && (
        <div style={{ display: 'flex', gap: 14, fontSize: 13, marginBottom: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="radio" name="echelle-flash" checked={echelleAffichee === 'v'} onChange={() => changerEchelle('v')} />
            {t('Cote V', 'V grade')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="radio"
              name="echelle-flash"
              checked={echelleAffichee !== 'v'}
              onChange={() => changerEchelle(echelleCentre)}
            />
            {t('Cote Rose Bloc (1 à 15)', 'Rose Bloc grade (1 to 15)')}
          </label>
        </div>
      )}
      <select id="choix-flash" value={valeur} onChange={(e) => onChange(e.currentTarget.value)} style={{ minWidth: 220 }}>
        <option value="" disabled>
          {t('Choisir…', 'Choose…')}
        </option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
        {!sansInconnu && <option value={INCONNU}>{t('Je ne sais pas', "I don't know")}</option>}
      </select>
      <p className="param-aide" style={{ margin: '4px 0 0' }}>
        {t(
          "Flasher : réussir un bloc au premier essai, sans l'avoir vu grimper. Sert de point de départ à votre cote, qui s'ajuste ensuite à vos résultats. Ne pourra pas être changé.",
          "Flash: sending a boulder on the first try, without having seen it climbed. Used as the starting point of your rating, which then adjusts to your results. Can't be changed later."
        )}
      </p>
    </>
  )
}

/**
 * Panneau de connexion, sous l'en-tete : Google, ou courriel et mot de passe
 * -> pseudonyme (premiere connexion seulement) -> connecte. Sert aussi a
 * choisir un nouveau mot de passe au retour du lien « mot de passe oublie ».
 */
export function PanneauCompte({
  compte,
  apresProfil,
}: {
  compte: Compte
  /** `centre` : centre principal choisi a la creation du profil, s'il y en a un. */
  apresProfil: (centre?: string | null) => void
}) {
  const { t } = useLangue()
  const centres = useCentres()
  // Centre principal : id, AUCUN_CENTRE, ou '' tant que rien n'est choisi.
  const [centre, setCentre] = useState('')
  const echelleCentre = centres.find((c) => c.id === centre)?.echelle ?? 'v'
  const centreConnu = centre && centre !== AUCUN_CENTRE ? centre : null
  const [courriel, setCourriel] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'oubli'>('connexion')
  const [pseudo, setPseudo] = useState('')
  // Cote flashee ('V4'), INCONNU, ou '' tant que rien n'est choisi.
  const [flash, setFlash] = useState('')
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
            <div style={{ marginBottom: 12 }}>
              {/* Enregistre au changement : n'entre dans aucun calcul, rien a confirmer. */}
              <ChoixCentre
                centres={centres}
                valeur={centres.find((c) => c.nom === compte.grimpeur?.gymPrincipal)?.id ?? (compte.grimpeur.gymPrincipal ? '' : AUCUN_CENTRE)}
                onChange={(v) =>
                  void agir(
                    () => compte.definirCentre(v === AUCUN_CENTRE ? null : v),
                    () => setInfo(t('Centre enregistré.', 'Gym saved.'))
                  )
                }
              />
            </div>
            {!compte.grimpeur.niveauDeclare && (
              // Compte cree avant la question du flash : il peut la donner une fois.
              <form
                style={{ marginBottom: 12 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  if (flash && flash !== INCONNU)
                    void agir(() => compte.declarerFlash(flash), () => {
                      setInfo(t('Niveau enregistré.', 'Level saved.'))
                      apresProfil()
                    })
                }}
              >
                <ChoixFlash
                  valeur={flash}
                  onChange={setFlash}
                  sansInconnu
                  echelleCentre={centres.find((c) => c.nom === compte.grimpeur?.gymPrincipal)?.echelle ?? 'v'}
                />
                <div className="barre-outils" style={{ marginTop: 6 }}>
                  <button className="bouton" type="submit" disabled={occupe || !flash}>
                    {t('Enregistrer mon niveau', 'Save my level')}
                  </button>
                </div>
              </form>
            )}
            <button className="bouton" onClick={() => void compte.deconnecter()}>
              {t('Se déconnecter', 'Sign out')}
            </button>
          </>
        ) : compte.courriel ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void agir(
                () => compte.creerProfil(pseudo, flash && flash !== INCONNU ? flash : null, centreConnu),
                () => apresProfil(centreConnu)
              )
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
            </div>
            <div style={{ margin: '12px 0 8px' }}>
              <ChoixCentre
                centres={centres}
                valeur={centre}
                onChange={(v) => {
                  // Une cote 1-15 n'a plus de sens si le centre change d'echelle.
                  if ((centres.find((c) => c.id === v)?.echelle ?? 'v') !== echelleCentre) setFlash('')
                  setCentre(v)
                }}
              />
            </div>
            <div style={{ margin: '12px 0 8px' }}>
              <ChoixFlash valeur={flash} onChange={setFlash} echelleCentre={echelleCentre} />
            </div>
            <div className="barre-outils">
              <button className="bouton" type="submit" disabled={occupe || pseudo.trim().length < 2 || !flash || !centre}>
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
