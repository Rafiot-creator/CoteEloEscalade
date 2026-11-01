/**
 * Nom donne d'office a un bloc pose sur la carte, lisible plutot que son
 * identifiant technique : Style-Cote-Couleur-Secteur, ex.
 * « Coordo-10-Rose-Bat-Cave » (demande de Raphael). Chaque partie absente est
 * sautee (pas de style choisi, pas d'etiquette de secteur sur la carte).
 *
 * Le secteur est l'etiquette de secteur la plus proche de la pastille : les
 * cartes n'ont que ces etiquettes, pas les limites entre secteurs (choix de
 * Raphael, en sachant qu'un bloc pres d'une limite peut tomber du mauvais
 * cote ; l'ouvreur corrige alors le nom a la main).
 *
 * Le nom suit le bloc (style, cote, couleur, position) tant que personne ne
 * l'a tape a la main : voir `estNomAuto`.
 */

/** Etiquette de secteur, position dans le repere de la carte (0 a 1). */
export interface EtiquetteSecteur {
  nom: string
  x: number
  y: number
}

/** Fond de carte lu pour en tirer les secteurs. */
export interface SecteursCarte {
  etiquettes: EtiquetteSecteur[]
  /** Largeur / hauteur du fond, pour mesurer les distances sans deformation. */
  ratio: number
}

/** Longueur maximale d'un nom (meme limite que `verifier_champs_bloc` dans la base). */
export const NOM_MAX = 40

/**
 * Lit les etiquettes de secteurs d'un fond de carte SVG : les textes en gras
 * gris fonce (`font-weight="700"`, `fill="#333"`), convention des cartes du
 * dossier public/cartes/ ; les autres textes (accueil, vestiaires...) sont
 * plus clairs et ne sont pas des murs. Une etiquette sur deux lignes
 * (« MUR DE » / « VITESSE ») est recollee.
 */
export function lireSecteurs(svg: string): SecteursCarte | null {
  const vb = /viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*"/.exec(svg)
  if (!vb) return null
  const [x0, y0, l, h] = vb.slice(1).map(Number)
  if (!(l > 0 && h > 0)) return null
  const lignes: { texte: string; x: number; y: number; taille: number }[] = []
  for (const m of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const attrs = m[1]
    if (!/font-weight="700"/.test(attrs) || !/fill="#333"/i.test(attrs)) continue
    const attr = (nom: string) => Number(new RegExp(`\\b${nom}="([-\\d.]+)"`).exec(attrs)?.[1])
    const texte = decoderEntites(m[2]).trim()
    if (!texte) continue
    lignes.push({ texte, x: attr('x'), y: attr('y'), taille: attr('font-size') || 12 })
  }
  // Recolle les lignes d'une meme etiquette : meme x, l'une juste sous l'autre.
  const etiquettes: { texte: string; x: number; y: number }[] = []
  for (const li of lignes) {
    const prec = etiquettes[etiquettes.length - 1]
    const derniere = lignes[lignes.indexOf(li) - 1]
    if (prec && derniere && derniere.x === li.x && li.y > derniere.y && li.y - derniere.y <= li.taille * 2) {
      prec.texte += ' ' + li.texte
      prec.y = (prec.y + li.y) / 2
    } else etiquettes.push({ texte: li.texte, x: li.x, y: li.y })
  }
  return {
    ratio: l / h,
    etiquettes: etiquettes
      .filter((e) => Number.isFinite(e.x) && Number.isFinite(e.y))
      .map((e) => ({ nom: e.texte, x: (e.x - x0) / l, y: (e.y - y0) / h })),
  }
}

function decoderEntites(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/** Secteur dont l'etiquette est la plus proche du point (x, y), ou null. */
export function secteurProche(secteurs: SecteursCarte | null, x: number, y: number): string | null {
  let meilleur: string | null = null
  let dMin = Infinity
  for (const e of secteurs?.etiquettes ?? []) {
    const d = ((e.x - x) * secteurs!.ratio) ** 2 + (e.y - y) ** 2
    if (d < dMin) {
      dMin = d
      meilleur = e.nom
    }
  }
  return meilleur
}

/** « LE FIN FOND » -> « Le-Fin-Fond » ; « TITANIC + LE 35° » -> « Titanic-Le-35° ». */
export function enMorceau(texte: string): string {
  return texte
    .split(/[^\p{L}\p{N}'°★]+/u)
    .filter(Boolean)
    .map((mot) => mot.charAt(0).toLocaleUpperCase('fr') + mot.slice(1).toLocaleLowerCase('fr'))
    .join('-')
}

/** Nom de base, sans numero de doublon : Style-Cote-Couleur-Secteur. */
export function nomDeBase(parties: { style: string; cote: string; couleur: string; secteur: string | null }): string {
  return [parties.style, parties.cote, parties.couleur, parties.secteur ?? '']
    .map(enMorceau)
    .filter(Boolean)
    .join('-')
    .slice(0, NOM_MAX - 3)
    .replace(/-+$/, '')
}

/**
 * Nom de base rendu unique parmi les noms deja pris : « Base », sinon
 * « Base-2 », « Base-3 »...
 */
export function nomUnique(base: string, pris: Iterable<string>): string {
  const deja = new Set(pris)
  if (!deja.has(base)) return base
  for (let i = 2; ; i++) if (!deja.has(`${base}-${i}`)) return `${base}-${i}`
}

/**
 * Le nom actuel est-il encore un nom donne d'office (donc a mettre a jour) ?
 * Oui s'il est vide, egal a l'identifiant technique (blocs poses avant cette
 * regle, ou nom efface par l'ouvreur), ou egal au nom de base calcule pour
 * l'etat precedent du bloc, avec ou sans numero de doublon. Un nom tape a la
 * main ne correspond a aucun de ces cas et n'est jamais ecrase.
 */
export function estNomAuto(nom: string | undefined, id: string, basesAvant: string[]): boolean {
  const n = (nom ?? '').trim()
  if (!n || n === id) return true
  return basesAvant.some(
    (base) => !!base && (n === base || (n.startsWith(base + '-') && /^\d+$/.test(n.slice(base.length + 1))))
  )
}
