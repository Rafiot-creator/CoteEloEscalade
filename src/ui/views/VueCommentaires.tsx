import { useState } from 'react'
import { supabase } from '../../core/supabase'
import { Carte } from '../components/base'
import { useLangue } from '../langue'

type TypeCommentaire = 'probleme' | 'suggestion' | 'autre'

const LONGUEUR_MAX = 2000

/**
 * Commentaires et signalements, ouverts a tous, meme sans compte (un probleme
 * de connexion doit pouvoir se signaler). Ecrit par `envoyer_commentaire`
 * (supabase/migrations/20261031000300_commentaires.sql), qui verifie les
 * champs et limite le debit ; seul l'admin general lit les messages (ecran
 * Administration).
 *
 * Le contexte utile a un signalement (centre, appareil et navigateur) est
 * joint d'office, et annonce sous le formulaire ; le pseudonyme l'est par la
 * base, d'apres la session.
 */
export function VueCommentaires({ centre, pseudo }: { centre: string; pseudo: string | null }) {
  const { t } = useLangue()
  const [type, setType] = useState<TypeCommentaire>('probleme')
  const [message, setMessage] = useState('')
  const [courriel, setCourriel] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoye, setEnvoye] = useState(false)

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault()
    setOccupe(true)
    setErreur(null)
    const appareil = `${navigator.userAgent} · ${window.innerWidth}×${window.innerHeight}`
    const { error } = await supabase.rpc('envoyer_commentaire', {
      type,
      message: message.trim(),
      courriel: courriel.trim(),
      centre,
      appareil,
    })
    setOccupe(false)
    if (error) {
      setErreur(error.message)
      return
    }
    setEnvoye(true)
    setMessage('')
  }

  if (envoye) {
    return (
      <div className="large">
        <Carte titre={t('Merci !', 'Thank you!')}>
          <p>
            {t(
              'Votre message a bien été envoyé. Il sera lu par le responsable du site.',
              'Your message was sent. The site owner will read it.'
            )}
          </p>
          <button className="bouton" onClick={() => setEnvoye(false)}>
            {t('Envoyer un autre message', 'Send another message')}
          </button>
        </Carte>
      </div>
    )
  }

  return (
    <div className="large">
      <Carte
        titre={t('Commentaires', 'Feedback')}
        sousTitre={t(
          'Un problème avec le site, une idée, une remarque ? Écrivez-nous.',
          'A problem with the site, an idea, a remark? Let us know.'
        )}
      >
        <form onSubmit={(e) => void envoyer(e)} style={{ maxWidth: 640 }}>
          <div className="param">
            <div className="param-tete">
              <label htmlFor="commentaire-type">{t('Type', 'Type')}</label>
            </div>
            <select id="commentaire-type" value={type} onChange={(e) => setType(e.currentTarget.value as TypeCommentaire)}>
              <option value="probleme">{t('Problème', 'Problem')}</option>
              <option value="suggestion">{t('Suggestion', 'Suggestion')}</option>
              <option value="autre">{t('Autre', 'Other')}</option>
            </select>
          </div>
          <div className="param">
            <div className="param-tete">
              <label htmlFor="commentaire-message">{t('Message', 'Message')}</label>
              <span className="param-valeur">
                {message.length} / {LONGUEUR_MAX}
              </span>
            </div>
            <textarea
              id="commentaire-message"
              value={message}
              maxLength={LONGUEUR_MAX}
              rows={7}
              required
              placeholder={
                type === 'probleme'
                  ? t(
                      "Que s'est-il passé ? Sur quel écran, en faisant quoi ?",
                      'What happened? On which screen, while doing what?'
                    )
                  : ''
              }
              onChange={(e) => setMessage(e.currentTarget.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          <div className="param">
            <div className="param-tete">
              <label htmlFor="commentaire-courriel">{t('Votre courriel (facultatif)', 'Your email (optional)')}</label>
            </div>
            <input
              id="commentaire-courriel"
              type="email"
              value={courriel}
              maxLength={200}
              autoComplete="email"
              onChange={(e) => setCourriel(e.currentTarget.value)}
              style={{ width: '100%' }}
            />
            <p className="param-aide">
              {t(
                'Seulement pour pouvoir vous répondre. Visible par le responsable du site uniquement.',
                'Only so we can reply. Visible to the site owner only.'
              )}
            </p>
          </div>
          <p className="param-aide">
            {t(
              `Joint automatiquement : le centre choisi « ${centre} »${pseudo ? `, votre pseudonyme « ${pseudo} »` : ''}, le type d'appareil et de navigateur, et la date. `,
              `Attached automatically: the selected gym "${centre}"${pseudo ? `, your username "${pseudo}"` : ''}, your device and browser type, and the date. `
            )}
            <a href="confidentialite.html">{t('Politique de confidentialité', 'Privacy policy')}</a>
          </p>
          {erreur && <p style={{ color: 'var(--critique)' }}>{erreur}</p>}
          <button className="bouton" type="submit" disabled={occupe || !message.trim()}>
            {occupe ? t('Envoi…', 'Sending…') : t('Envoyer', 'Send')}
          </button>
        </form>
      </Carte>
    </div>
  )
}
