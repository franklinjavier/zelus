import { href } from 'react-router'

const MAX_DIMENSION = 2048
const JPEG_QUALITY = 0.8
const COMPRESS_THRESHOLD = 2 * 1024 * 1024 // 2 MB

/**
 * Compress an image file using the browser Canvas API.
 * Resizes to fit within MAX_DIMENSION and re-encodes as JPEG.
 * Returns the original file if it's not an image or already small enough.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= COMPRESS_THRESHOLD) {
    return file
  }

  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
  const name = file.name.replace(/\.[^.]+$/, '.jpg')

  return new File([blob], name, { type: 'image/jpeg' })
}

/**
 * Upload a file to Vercel Blob via server-side route.
 * Images over 2 MB are compressed before upload.
 */
export async function uploadFile(
  file: File,
  options?: {
    access?: 'public' | 'private'
    pathname?: string
    onUploadProgress?: (p: { percentage: number }) => void
  },
): Promise<{ url: string }> {
  const access = options?.access ?? 'public'
  const compressed = await compressImage(file)

  const formData = new FormData()
  formData.set('file', compressed)
  formData.set('access', access)
  if (options?.pathname) {
    formData.set('pathname', options.pathname)
  }

  const res = await fetch(href('/api/upload-server'), {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Erro ao carregar ficheiro.')
  }

  return res.json()
}
