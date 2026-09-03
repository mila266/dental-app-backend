import type { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export async function requireActiveSession(req: Request, res: Response, next: NextFunction) {
  const user = req.user
  if (!user) {
    return res.status(401).json({ error: 'No autenticado', code: 'TOKEN_INVALID' })
  }

  const esPaciente = user.role === 'paciente'
  const tabla = esPaciente ? 'paciente' : 'usuario'
  const columnas = esPaciente ? 'token_version' : 'token_version,activo'

  const { data, error } = await supabase
    .from(tabla)
    .select(columnas)
    .eq('id', user.sub)
    .single() as unknown as { data: any; error: any }

  if (error || !data) {
    return res.status(401).json({ error: 'Sesión revocada', code: 'SESSION_REVOKED' })
  }

  if (!esPaciente && data.activo === false) {
    return res.status(401).json({ error: 'Sesión revocada', code: 'SESSION_REVOKED' })
  }

  if (data.token_version !== user.tokenVersion) {
    return res.status(401).json({ error: 'Sesión revocada', code: 'SESSION_REVOKED' })
  }

  next()
}
