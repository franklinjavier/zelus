import { describe, expect, it } from 'vitest'
import { generateFractionLabels } from '../fractions-generator'

describe('generateFractionLabels', () => {
  it('generates labels for numeric floors with two positions', () => {
    const result = generateFractionLabels({
      floorFrom: 1,
      floorTo: 3,
      includeRC: false,
      positions: ['Esq', 'Dir'],
      suffix: 'T3',
    })
    expect(result).toEqual([
      '1º Esq T3',
      '1º Dir T3',
      '2º Esq T3',
      '2º Dir T3',
      '3º Esq T3',
      '3º Dir T3',
    ])
  })

  it('prepends RC when includeRC is true', () => {
    const result = generateFractionLabels({
      floorFrom: 1,
      floorTo: 1,
      includeRC: true,
      positions: ['Esq'],
      suffix: '',
    })
    expect(result).toEqual(['RC Esq', '1º Esq'])
  })

  it('omits suffix when empty', () => {
    const result = generateFractionLabels({
      floorFrom: 1,
      floorTo: 1,
      includeRC: false,
      positions: ['A'],
      suffix: '',
    })
    expect(result).toEqual(['1º A'])
  })

  it('returns empty array when no positions', () => {
    const result = generateFractionLabels({
      floorFrom: 1,
      floorTo: 3,
      includeRC: false,
      positions: [],
      suffix: 'T2',
    })
    expect(result).toEqual([])
  })

  it('returns only RC floors when floorFrom > floorTo but includeRC is true', () => {
    const result = generateFractionLabels({
      floorFrom: 5,
      floorTo: 1,
      includeRC: true,
      positions: ['Dir'],
      suffix: '',
    })
    expect(result).toEqual(['RC Dir'])
  })
})
