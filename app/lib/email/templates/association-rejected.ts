export function associationRejectedEmail(params: {
  userName: string
  fractionLabel: string
  orgName: string
}) {
  return {
    subject: `Associação rejeitada — ${params.fractionLabel}`,
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px;">Associação rejeitada</h2>
  <p>Olá ${params.userName},</p>
  <p>A sua associação à fração <strong>${params.fractionLabel}</strong> em ${params.orgName} foi rejeitada.</p>
  <p style="color: #666; font-size: 14px;">Se acredita que houve um engano, contacte a administração do condomínio.</p>
</body>
</html>`.trim(),
  }
}
