import { getAppUrl } from '~/lib/misc/app-url'

export function waitlistConfirmEmail(params: { name: string }) {
  const logoUrl = `${getAppUrl()}/logo.png`

  return {
    subject: 'Bem-vindo à lista de espera do Zelus',
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <div style="text-align: center; margin-bottom: 24px;">
    <img src="${logoUrl}" alt="Zelus" width="48" height="48" style="border: 0;" />
  </div>
  <h2 style="margin: 0 0 16px;">Obrigado, ${params.name}!</h2>
  <p>Recebemos a sua inscrição na lista de espera do Zelus.</p>
  <p>O Zelus é uma plataforma para gerir o seu condomínio de forma simples e transparente. Estamos a preparar tudo para que a experiência seja a melhor possível.</p>
  <p>Entraremos em contacto assim que o acesso estiver disponível.</p>
  <p style="margin-top: 24px;">Até breve,<br><strong>Equipa Zelus</strong></p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #666; font-size: 12px; text-align: center;">
    Do latim zelus: o cuidado vigilante pelo que é de todos.
  </p>
</body>
</html>`.trim(),
  }
}
