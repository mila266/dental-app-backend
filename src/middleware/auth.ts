import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export type AuthUser = {
  id: string
  nombre: string
  email?: string
  role?: string
  clinica_id?: string
  doctor_id?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dentalapp-secret') as AuthUser
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
