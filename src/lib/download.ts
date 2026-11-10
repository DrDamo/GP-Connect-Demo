/** Offers `content` to the browser as a file download. `bom` prefixes a UTF-8
 *  byte-order mark so Excel opens non-ASCII CSV text (e.g. "Sjögren's") correctly. */
export function downloadTextFile(content: string, filename: string, mime: string, { bom = false } = {}): void {
  const blob = new Blob([bom ? '﻿' + content : content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadJson(json: string, filename: string): void {
  downloadTextFile(json, filename, 'application/json')
}
