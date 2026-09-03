import { rateLimit } from 'express-rate-limit'
import type { Request, Response } from 'express'

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const identificador = String(req.body?.email ?? req.body?.dni ?? '').toLowerCase()
    return `${req.ip}:${identificador}`
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Demasiados intentos, intentá de nuevo más tarde', code: 'RATE_LIMITED' })
  },
})
