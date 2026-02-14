export function fractionInviteEmail(params: {
  orgName: string
  fractionLabel: string
  inviterName: string
  inviteUrl: string
}) {
  return {
    subject: `Convite para fração ${params.fractionLabel} — Zelus`,
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px;">Convite para fração</h2>
  <p>${params.inviterName} convidou-o para a fração <strong>${params.fractionLabel}</strong> em ${params.orgName} no Zelus.</p>
  <p style="margin: 24px 0;">
    <a href="${params.inviteUrl}"
       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 32px; text-decoration: none; font-weight: 500;">
      Aceitar convite
    </a>
  </p>
  <p style="color: #666; font-size: 14px;">Se não esperava este convite, pode ignorar este email.</p>
</body>
</html>`.trim(),
  }
}
