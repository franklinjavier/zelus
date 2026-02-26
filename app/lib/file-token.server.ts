import { createHmac, timingSafeEqual } from 'crypto'

const TTL_SECONDS = 15 * 60 // 15 minutes

function getSecret() {
  const secret = process.env.BLOB_READ_WRITE_TOKEN
  if (!secret) throw new Error('BLOB_READ_WRITE_TOKEN is not set')
  return secret
}

export function signFileUrl(blobUrl: string): string {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS
  const payload = Buffer.from(JSON.stringify({ u: blobUrl, e: expires })).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(payload).digest('base64url')
  return `/api/file?t=${payload}.${sig}`
}

export function verifyFileToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const payload = token.slice(0, dot)
    const sig = token.slice(dot + 1)

    const expectedSig = createHmac('sha256', getSecret()).update(payload).digest('base64url')
    const expectedBuf = Buffer.from(expectedSig)
    const actualBuf = Buffer.from(sig)
    if (expectedBuf.length !== actualBuf.length) return null
    if (!timingSafeEqual(expectedBuf, actualBuf)) return null

    const { u, e } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (Math.floor(Date.now() / 1000) > e) return null

    return u as string
  } catch {
    return null
  }
}
