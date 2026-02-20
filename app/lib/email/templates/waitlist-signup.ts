import { getAppUrl } from '~/lib/misc/app-url'

export function waitlistSignupEmail(params: { name: string; email: string }) {
  const logoUrl = `${getAppUrl()}/logo.png`

  return {
    subject: `Nova inscrição na waitlist: ${params.name}`,
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${logoUrl}" alt="Zelus" width="48" height="48" style="border: 0;" />
  </div>
  <h2 style="margin: 0 0 16px;">Nova inscrição na waitlist</h2>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr>
      <td style="padding: 8px 0; color: #666; width: 80px;">Nome</td>
      <td style="padding: 8px 0; font-weight: 500;">${params.name}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Email</td>
      <td style="padding: 8px 0; font-weight: 500;">${params.email}</td>
    </tr>
  </table>
  <p style="color: #666; font-size: 14px;">Este email foi enviado automaticamente pelo Zelus.</p>
</body>
</html>`.trim(),
  }
}
