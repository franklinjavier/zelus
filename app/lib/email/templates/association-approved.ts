export function associationApprovedEmail(params: {
  userName: string
  fractionLabel: string
  orgName: string
  fractionUrl: string
}) {
  return {
    subject: `Associação aprovada — ${params.fractionLabel}`,
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px;">Associação aprovada</h2>
  <p>Olá ${params.userName},</p>
  <p>A sua associação à fração <strong>${params.fractionLabel}</strong> em ${params.orgName} foi aprovada.</p>
  <p style="margin: 24px 0;">
    <a href="${params.fractionUrl}"
       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 32px; text-decoration: none; font-weight: 500;">
      Ver fração
    </a>
  </p>
</body>
</html>`.trim(),
  }
}
