import { Router } from 'express'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { supabase } from '../lib/supabase'
import { env } from '../lib/env'
import {
  signAccessToken,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from '../lib/tokens'

const router: Router = Router()

type RefreshPayload = { sub: string; role: string; tokenVersion: number }

router.post('/refresh', async (req: Request, res: Response) => {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE_NAME]

  if (!cookieToken) {
    return res.status(401).json({ error: 'No hay sesión para refrescar', code: 'REFRESH_MISSING' })
  }

  let decoded: RefreshPayload
  try {
    decoded = jwt.verify(cookieToken, env.JWT_REFRESH_SECRET) as RefreshPayload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'La sesión venció, iniciá sesión de nuevo', code: 'REFRESH_EXPIRED' })
    }
    return res.status(401).json({ error: 'Sesión inválida', code: 'REFRESH_INVALID' })
  }

  const esPaciente = decoded.role === 'paciente'
  const tabla = esPaciente ? 'paciente' : 'usuario'
  const columnas = esPaciente ? 'id,clinica_id,token_version' : 'id,role,clinica_id,token_version,activo'

  const { data, error } = await supabase
    .from(tabla)
    .select(columnas)
    .eq('id', decoded.sub)
    .single() as unknown as { data: any; error: any }

  if (error || !data) {
    return res.status(401).json({ error: 'Sesión revocada', code: 'REFRESH_REVOKED' })
  }

  if (!esPaciente && data.activo === false) {
    return res.status(401).json({ error: 'Sesión revocada', code: 'REFRESH_REVOKED' })
  }

  if (data.token_version !== decoded.tokenVersion) {
    return res.status(401).json({ error: 'Sesión revocada', code: 'REFRESH_REVOKED' })
  }

  const accessToken = signAccessToken({
    sub: data.id,
    role: esPaciente ? 'paciente' : data.role,
    clinica_id: data.clinica_id ?? null,
    tokenVersion: data.token_version,
  })

  return res.json({ token: accessToken })
})

router.post('/logout', async (req: Request, res: Response) => {
  let sub: string | undefined
  let role: string | undefined

  const authHeader = req.headers.authorization
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, env.JWT_ACCESS_SECRET) as { sub: string; role: string }
      sub = decoded.sub
      role = decoded.role
    } catch {
      // el access token ya venció o es inválido; intentamos con el refresh token
    }
  }

  if (!sub) {
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE_NAME]
    if (cookieToken) {
      try {
        const decoded = jwt.verify(cookieToken, env.JWT_REFRESH_SECRET) as RefreshPayload
        sub = decoded.sub
        role = decoded.role
      } catch {
        // ninguno de los dos tokens es válido; no hay nada que revocar en DB
      }
    }
  }

  if (sub) {
    const tabla = role === 'paciente' ? 'paciente' : 'usuario'
    const { data } = await supabase.from(tabla).select('token_version').eq('id', sub).single() as unknown as { data: any }
    if (data) {
      await supabase.from(tabla).update({ token_version: (data.token_version ?? 0) + 1 }).eq('id', sub)
    }
  }

  clearRefreshCookie(res)
  return res.status(204).send()
})

export default router
