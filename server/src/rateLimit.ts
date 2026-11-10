import type { Request, Response, NextFunction } from 'express'

// Fixed-window request limiter, kept in memory per client key. Enough for a
// single proxy process; several processes behind a load balancer would each
// count separately and need a shared store instead.

interface Window { start: number; count: number }

export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const windows = new Map<string, Window>()

  // Drop expired windows so the map can't grow without bound.
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, w] of windows) if (now - w.start >= windowMs) windows.delete(key)
  }, windowMs)
  sweep.unref()

  return (req: Request, res: Response, next: NextFunction) => {
    // req.ip honours X-Forwarded-For only when `trust proxy` is configured.
    const key = req.ip ?? 'unknown'
    const now = Date.now()
    let w = windows.get(key)
    if (!w || now - w.start >= windowMs) {
      w = { start: now, count: 0 }
      windows.set(key, w)
    }
    w.count++
    if (w.count > max) {
      const retryAfter = Math.ceil((w.start + windowMs - now) / 1000)
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'Too many requests — try again shortly' })
      return
    }
    next()
  }
}
