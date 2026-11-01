/*
 * Service worker de l'application installable (PWA).
 *
 * Seul role : que le site s'ouvre vite, et meme sans reseau, une fois installe
 * sur l'ecran d'accueil. Il ne garde en memoire QUE les fichiers du site
 * lui-meme (pages, code, icones, fonds de carte). Tout ce qui vient d'une autre
 * origine (Supabase : cotes, envois, blocs, comptes ; Google : connexion) n'est
 * jamais intercepte et passe directement par le reseau, comme sans service
 * worker. Le temps reel (WebSocket) ne passe de toute facon jamais par ici.
 *
 * Strategies :
 * - pages (navigation) : reseau d'abord, pour qu'une mise en ligne soit vue
 *   des le prochain lancement ; copie en memoire si le reseau ne repond pas
 *   (coupe, ou qui traine plus de DELAI_RESEAU ms : reseau faible en salle).
 * - `assets/` (code construit par Vite, nom contenant une empreinte, donc
 *   jamais modifie en place) : memoire d'abord.
 * - le reste (icones, fonds de carte, manifeste) : copie en memoire tout de
 *   suite, rafraichie en arriere-plan pour la fois suivante.
 *
 * Changer VERSION efface toutes les copies a la prochaine activation.
 */
const VERSION = 'v1'
const CACHE_PAGES = `pages-${VERSION}`
const CACHE_ASSETS = `assets-${VERSION}`
const CACHE_FICHIERS = `fichiers-${VERSION}`
const CACHES = [CACHE_PAGES, CACHE_ASSETS, CACHE_FICHIERS]
const DELAI_RESEAU = 4000
const MAX_ASSETS = 80

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches
      .open(CACHE_PAGES)
      .then((cache) => cache.add('./'))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => !CACHES.includes(c)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request
  if (requete.method !== 'GET') return
  const url = new URL(requete.url)
  if (url.origin !== self.location.origin) return

  if (requete.mode === 'navigate') {
    evenement.respondWith(page(evenement))
  } else if (url.pathname.includes('/assets/')) {
    evenement.respondWith(asset(requete))
  } else {
    evenement.respondWith(fichier(evenement))
  }
})

async function page(evenement) {
  const requete = evenement.request
  const cache = await caches.open(CACHE_PAGES)
  const reseau = fetch(requete).then((reponse) => {
    if (reponse.ok) cache.put(requete, reponse.clone())
    return reponse
  })
  // La mise en memoire continue meme si on a deja repondu avec la copie.
  evenement.waitUntil(reseau.catch(() => {}))
  const delai = new Promise((resoudre) => setTimeout(resoudre, DELAI_RESEAU))
  try {
    const premiere = await Promise.race([reseau, delai])
    if (premiere) return premiere
  } catch {
    // reseau coupe : on tombe sur la copie ci-dessous
  }
  const copie = (await cache.match(requete, { ignoreSearch: true })) ?? (await cache.match('./'))
  return copie ?? reseau
}

async function asset(requete) {
  const cache = await caches.open(CACHE_ASSETS)
  const copie = await cache.match(requete)
  if (copie) return copie
  const reponse = await fetch(requete)
  if (reponse.ok) {
    await cache.put(requete, reponse.clone())
    // Chaque mise en ligne ajoute de nouveaux fichiers : on oublie les plus anciens.
    const cles = await cache.keys()
    await Promise.all(cles.slice(0, Math.max(0, cles.length - MAX_ASSETS)).map((c) => cache.delete(c)))
  }
  return reponse
}

async function fichier(evenement) {
  const requete = evenement.request
  const cache = await caches.open(CACHE_FICHIERS)
  const copie = await cache.match(requete)
  const reseau = fetch(requete).then((reponse) => {
    if (reponse.ok) cache.put(requete, reponse.clone())
    return reponse
  })
  if (copie) {
    evenement.waitUntil(reseau.catch(() => {}))
    return copie
  }
  return reseau
}
