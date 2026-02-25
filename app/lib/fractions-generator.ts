export type GeneratorConfig = {
  floorFrom: number
  floorTo: number
  includeRC: boolean
  positions: string[]
  suffix: string
}

export function generateFractionLabels(config: GeneratorConfig): string[] {
  const { floorFrom, floorTo, includeRC, positions, suffix } = config

  if (positions.length === 0) return []

  const floors: string[] = []
  if (includeRC) floors.push('RC')
  for (let f = floorFrom; f <= floorTo; f++) {
    floors.push(`${f}º`)
  }

  if (floors.length === 0) return []

  return floors.flatMap((floor) =>
    positions.map((pos) => [floor, pos, suffix].filter(Boolean).join(' ')),
  )
}
