import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { enMorceau, estNomAuto, lireSecteurs, nomDeBase, nomUnique, secteurProche } from './nomAuto'

const svg = (fichier: string) => readFileSync(new URL(`../../../public/cartes/${fichier}`, import.meta.url), 'utf8')

describe('nom automatique des blocs', () => {
  it('lit les secteurs de Rose Bloc 1, sans les zones qui ne sont pas des murs', () => {
    const s = lireSecteurs(svg('rose-bloc-1.svg'))!
    const noms = s.etiquettes.map((e) => e.nom)
    expect(noms).toContain('BAT CAVE')
    expect(noms).toContain("KILTER'S HOMIES")
    expect(noms).not.toContain('ACCUEIL')
    expect(noms).not.toContain('VESTIAIRES')
  })

  it('recolle une etiquette sur deux lignes (Rose Bloc 2)', () => {
    const noms = lireSecteurs(svg('rose-bloc-2.svg'))!.etiquettes.map((e) => e.nom)
    expect(noms).toContain('MUR DE VITESSE')
    expect(noms).toContain('COMP WALL')
    expect(noms).not.toContain('SAUNA')
  })

  it("prend l'etiquette la plus proche de la pastille", () => {
    const s = lireSecteurs(svg('rose-bloc-1.svg'))!
    const bat = s.etiquettes.find((e) => e.nom === 'BAT CAVE')!
    expect(secteurProche(s, bat.x + 0.01, bat.y + 0.01)).toBe('BAT CAVE')
    expect(secteurProche(null, 0.5, 0.5)).toBeNull()
  })

  it('compose Style-Cote-Couleur-Secteur et saute les parties vides', () => {
    expect(nomDeBase({ style: 'Coordo', cote: '10', couleur: 'Rose', secteur: 'BAT CAVE' })).toBe('Coordo-10-Rose-Bat-Cave')
    expect(nomDeBase({ style: '', cote: '4', couleur: 'Bleu', secteur: null })).toBe('4-Bleu')
    expect(enMorceau('TITANIC + LE 35°')).toBe('Titanic-Le-35°')
    expect(nomDeBase({ style: 'Technique', cote: '12', couleur: 'Turquoise', secteur: "KILTER'S HOMIES ET ENCORE PLUS" }).length).toBeLessThanOrEqual(37)
  })

  it('numerote les doublons', () => {
    expect(nomUnique('A', ['B'])).toBe('A')
    expect(nomUnique('A', ['A', 'A-2'])).toBe('A-3')
  })

  it("ne reconnait comme automatique qu'un nom vide, technique ou calcule", () => {
    expect(estNomAuto('', 'b-1', ['X'])).toBe(true)
    expect(estNomAuto('b-1', 'b-1', ['X'])).toBe(true)
    expect(estNomAuto('4-Bleu-Le-Rose', 'b-1', ['4-Bleu-Le-Rose'])).toBe(true)
    expect(estNomAuto('4-Bleu-Le-Rose-2', 'b-1', ['4-Bleu-Le-Rose'])).toBe(true)
    expect(estNomAuto('La Grosse Baleine', 'b-1', ['4-Bleu-Le-Rose'])).toBe(false)
    expect(estNomAuto('4-Bleu-Le-Rose-bis', 'b-1', ['4-Bleu-Le-Rose'])).toBe(false)
  })
})
