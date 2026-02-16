/**
 * PT labels for category keys. Used in UI only.
 *
 * FIXME: refactor to use proper i18n
 */
export const categoryLabels: Record<string, string> = {
  plumbing: 'Canalização',
  sewage: 'Esgotos',
  gas: 'Gás',
  electricity: 'Eletricidade',
  common_lighting: 'Iluminação Áreas Comuns',
  elevators: 'Elevadores',
  hvac: 'Climatização (AVAC)',
  intercom: 'Videoporteiro / Intercom',
  security: 'Segurança',
  fire_safety: 'Segurança Contra Incêndio',
  gardening: 'Jardinagem',
  cleaning: 'Limpeza',
  pest_control: 'Controlo de Pragas',
  structural: 'Estrutura / Fachada',
  roofing: 'Cobertura / Telhado',
  parking: 'Parqueamento / Garagens',
  telecommunications: 'Telecomunicações',
  waste: 'Resíduos',
  painting: 'Pintura',
  other: 'Outro',
}

export function translateCategory(key: string): string {
  return categoryLabels[key] ?? key
}

export function hasCategoryLabel(key: string): boolean {
  return key in categoryLabels
}
