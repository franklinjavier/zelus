import { useEffect } from 'react'
import { toast } from 'sonner'

type ToastVariant = 'success' | 'warning' | 'error'

export function GlobalToast({
  message,
}: {
  message: { message: string; variant: ToastVariant } | null
}) {
  useEffect(() => {
    if (!message) return
    toast[message.variant](message.message, { id: 'global-toast', duration: 5000 })
  }, [message])
  return null
}
