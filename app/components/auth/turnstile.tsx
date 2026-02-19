import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback': () => void
        },
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadScript(): Promise<void> {
  if (document.getElementById(SCRIPT_ID)) {
    return window.turnstile ? Promise.resolve() : new Promise((r) => setTimeout(r, 100))
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Turnstile script'))
    document.head.appendChild(script)
  })
}

export function Turnstile() {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  // Skip rendering if no site key is configured (non-production environments)
  if (!siteKey) return null

  return <TurnstileWidget siteKey={siteKey} />
}

function TurnstileWidget({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState('')

  const onVerify = useCallback((t: string) => setToken(t), [])
  const onExpire = useCallback(() => setToken(''), [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      await loadScript()
      // Wait for turnstile to be available
      while (!window.turnstile && !cancelled) {
        await new Promise((r) => setTimeout(r, 50))
      }
      if (cancelled || !containerRef.current || !window.turnstile) return

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': onExpire,
      })
    }

    init()

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [onVerify, onExpire])

  return (
    <>
      <div ref={containerRef} />
      <input type="hidden" name="captchaToken" value={token} />
    </>
  )
}
