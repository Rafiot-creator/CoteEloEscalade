// Transforme le jeu de demonstration (data/*.csv) et les cartes
// (data/cartes/*.json) en une migration SQL qui remplit la base Supabase.
// Usage : node scripts/generer-seed-supabase.mjs
// A relancer apres `npm run data:generate` ou un changement de carte, puis
// appliquer avec `npx supabase db push`.
import fs from 'node:fs'
import Papa from 'papaparse'

const SORTIE = 'supabase/migrations/20261029000100_donnees_demo.sql'

// Memes centres que le menu de src/App.tsx.
const CENTRES = [
  ['demo', 'Démo (jeu de test)'],
  ['bloc-shop-chabanel', 'Bloc Shop Chabanel'],
  ['bloc-shop-hochelaga', 'Bloc Shop Hochelaga'],
  ['bloc-shop-mile-end', 'Bloc Shop Mile-End'],
  ['le-mouv', "Le Mouv'"],
  ['rose-bloc-1', 'Rose Bloc 1'],
  ['rose-bloc-2', 'Rose Bloc 2'],
]

const lire = (f) => Papa.parse(fs.readFileSync(f, 'utf8'), { header: true, skipEmptyLines: true }).data
const sql = (v) => (v === null || v === undefined || v === '' ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const valeurs = (lignes) => lignes.map((l) => `  (${l.map(sql).join(', ')})`).join(',\n')
// Par paquets : une seule instruction de 19 000 lignes passe, mais reste illisible en cas d'erreur.
const inserer = (table, colonnes, lignes, paquet = 2000) => {
  let s = ''
  for (let i = 0; i < lignes.length; i += paquet)
    s += `insert into public.${table} (${colonnes.join(', ')}) values\n${valeurs(lignes.slice(i, i + paquet))};\n\n`
  return s
}

const cartes = Object.fromEntries(
  fs.readdirSync('data/cartes').filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(`data/cartes/${f}`, 'utf8'))])
)
for (const id of Object.keys(cartes)) if (!CENTRES.some(([c]) => c === id)) throw new Error(`carte sans centre : ${id}`)

const position = new Map(cartes.demo.blocs.map((b) => [b.id, b]))
const blocs = lire('data/blocs.csv')
for (const b of cartes.demo.blocs) if (!blocs.some((l) => l.id === b.id)) throw new Error(`bloc de carte absent de blocs.csv : ${b.id}`)
for (const id of Object.keys(cartes)) if (id !== 'demo' && cartes[id].blocs.length) throw new Error(`blocs sur la carte ${id} : non pris en charge`)

let s = `-- Genere par scripts/generer-seed-supabase.mjs a partir de data/ : ne pas modifier a la main.\n\n`
s += inserer('centres', ['id', 'nom', 'fond', 'taille_pastilles'],
  CENTRES.map(([id, nom]) => [id, nom, cartes[id]?.fond ?? null, cartes[id]?.taillePastilles ?? 1]))
s += inserer('grimpeurs', ['id', 'nom', 'sexe', 'gym_principal', 'premiere_saison', 'niveau_declare'],
  lire('data/grimpeurs.csv').map((g) => [g.id, g.nom, g.sexe, g.gym_principal, +g.premiere_saison, g.niveau_declare]))
s += inserer('blocs', ['id', 'centre_id', 'nom', 'gym', 'secteur', 'couleur', 'cotation_officielle', 'date_ouverture', 'date_retrait', 'x', 'y'],
  blocs.map((b) => [b.id, 'demo', b.nom, b.gym, b.secteur, b.couleur, b.cotation_officielle, b.date_ouverture, b.date_retrait,
    position.get(b.id)?.x ?? null, position.get(b.id)?.y ?? null]))
s += inserer('ascensions', ['date', 'grimpeur_id', 'bloc_id', 'resultat', 'essais'],
  lire('data/ascensions.csv').map((a) => [a.date, a.grimpeur_id, a.bloc_id, a.resultat, +a.essais]))

fs.writeFileSync(SORTIE, s)
console.log(`${SORTIE} : ${(s.length / 1e6).toFixed(2)} Mo`)
