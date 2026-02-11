import { createCookie } from 'react-router'

type ToastVariant = 'success' | 'warning' | 'error'

const toastCookie = createCookie('__toast', {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 10,
})

export async function setToast(message: string, variant: ToastVariant = 'success') {
  return { 'set-cookie': await toastCookie.serialize({ message, variant }) }
}

export async function getToast(request: Request) {
  const value = await toastCookie.parse(request.headers.get('cookie'))
  return {
    toast: value as { message: string; variant: ToastVariant } | null,
    headers: { 'set-cookie': await toastCookie.serialize(null, { maxAge: 0 }) },
  }
}
