import { getAppUrl } from '~/lib/misc/app-url'

export function emailVerificationEmail(name: string, url: string) {
  const logoUrl = `${getAppUrl()}/logo.png`

  return {
    subject: 'Verificar email — Zelus',
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${logoUrl}" alt="Zelus" width="48" height="48" style="border: 0;" />
  </div>
  <h2 style="margin: 0 0 16px;">Verificar email</h2>
  <p>Olá${name ? ` ${name}` : ''}, confirme o seu endereço de email para começar a usar o Zelus.</p>
  <p style="margin: 24px 0;">
    <a href="${url}"
       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 32px; text-decoration: none; font-weight: 500;">
      Verificar email
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">Se não criou uma conta no Zelus, pode ignorar este email.</p>
</body>
</html>`.trim(),
  }
}
