import { useCallback, useEffect, useState } from 'react'

export interface AnchoredPosition {
  top: number
  left: number
  width: number
}

/**
 * Tracks the viewport position of an anchor element so a dropdown can be
 * rendered via a portal (position: fixed) instead of `position: absolute`
 * within the normal DOM tree — that avoids being clipped by an ancestor
 * with `overflow: hidden`/`auto` (e.g. a collapsible card or modal body).
 */
export function useAnchoredDropdown(
  anchorRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
): AnchoredPosition | null {
  const [pos, setPos] = useState<AnchoredPosition | null>(null)

  const update = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
  }, [anchorRef])

  useEffect(() => {
    if (!isOpen) return
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [isOpen, update])

  return isOpen ? pos : null
}
