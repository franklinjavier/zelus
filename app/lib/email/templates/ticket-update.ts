const statusLabels: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em progresso',
  resolved: 'Resolvido',
  closed: 'Fechado',
}

export function ticketUpdateEmail(params: {
  ticketTitle: string
  newStatus: string
  ticketUrl: string
}) {
  const statusLabel = statusLabels[params.newStatus] ?? params.newStatus

  return {
    subject: `Ocorrência atualizada — ${params.ticketTitle}`,
    html: `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px;">Ocorrência atualizada</h2>
  <p>A ocorrência <strong>${params.ticketTitle}</strong> foi atualizada para o estado <strong>${statusLabel}</strong>.</p>
  <p style="margin: 24px 0;">
    <a href="${params.ticketUrl}"
       style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 32px; text-decoration: none; font-weight: 500;">
      Ver ocorrência
    </a>
  </p>
</body>
</html>`.trim(),
  }
}
