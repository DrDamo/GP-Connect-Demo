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

/**
 * Widens an anchored dropdown beyond its (possibly narrow) anchor — e.g. a
 * SNOMED/dm+d search box that's only a few characters wide in a dense grid
 * still needs room to show a full clinical term. Never narrower than the
 * anchor itself (so a wide anchor's dropdown looks unchanged), grows up to
 * `preferredWidth` when there's room, and never overflows past the right
 * edge of the viewport.
 */
export function widenDropdown(pos: AnchoredPosition, preferredWidth = 420, margin = 16): number {
  const available = window.innerWidth - pos.left - margin
  return Math.max(pos.width, Math.min(preferredWidth, available))
}
