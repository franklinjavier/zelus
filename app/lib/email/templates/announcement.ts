import { getAppUrl } from '~/lib/misc/app-url'

export function announcementEmail(params: {
  orgName: string
  title: string
  description: string
  eventDate: Date
}) {
  const logoUrl = `${getAppUrl()}/logo.png`
  const homeUrl = `${getAppUrl()}/home`
  const formattedDate = params.eventDate.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return {
    subject: `Aviso: ${params.title} — ${params.orgName}`,
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${logoUrl}" alt="Zelus" width="48" height="48" style="border: 0;" />
  </div>
  <h2 style="margin: 0 0 8px;">${params.title}</h2>
  <p style="color: #666; margin: 0 0 16px; font-size: 14px;">${formattedDate}</p>
  <p>${params.description}</p>
  <p style="margin: 24px 0;">
    <a href="${homeUrl}"
       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 32px; text-decoration: none; font-weight: 500;">
      Ver no Zelus
    </a>
  </p>
</body>
</html>`.trim(),
  }
}
