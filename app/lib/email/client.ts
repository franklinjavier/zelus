import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY

const resend = apiKey ? new Resend(apiKey) : null

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'Zelus <noreply@zelus.pt>'

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  if (!resend) {
    console.log('[Email] (dev mode — no RESEND_API_KEY)')
    console.log(`  To: ${params.to}`)
    console.log(`  Subject: ${params.subject}`)
    console.log(`  Body: ${params.html.slice(0, 200)}...`)
    return
  }

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })
}
