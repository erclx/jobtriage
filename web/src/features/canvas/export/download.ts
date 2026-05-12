export interface DownloadInput {
  readonly content: string
  readonly mimeType: 'text/markdown' | 'text/csv'
  readonly filename: string
}

export function triggerDownload({
  content,
  mimeType,
  filename,
}: DownloadInput): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
