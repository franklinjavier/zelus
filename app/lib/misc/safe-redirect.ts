export function getSafeRedirect(request: Request, fallback: string): string {
  const url = new URL(request.url)
  const to = url.searchParams.get('redirect')
  if (to && to.startsWith('/') && !to.startsWith('//')) return to
  return fallback
}
