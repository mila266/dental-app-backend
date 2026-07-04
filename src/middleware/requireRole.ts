// backend: src/middleware/requireRole.ts
import type { Request, Response, NextFunction } from 'express'

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' })
    }
    next()
  }
}