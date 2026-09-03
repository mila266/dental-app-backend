import jwt from 'jsonwebtoken'
import type { Response } from 'express'
import { env } from './env'

export type AccessPayload = {
  sub: string
  role: string
  clinica_id: string | null
  tokenVersion: number
}

export type RefreshPayload = {
  sub: string
  role: string
  tokenVersion: number
}

export const REFRESH_COOKIE_NAME = 'dentalapp_rt'

function parseTtlMs(ttl: string, fallbackMs: number): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl.trim())
  if (!match) return fallbackMs
  const value = Number(match[1])
  const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const
  return value * unitMs[match[2] as 's' | 'm' | 'h' | 'd']
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  })
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  })
}

export function setRefreshCookie(res: Response, token: string): void {
  const isProd = env.NODE_ENV === 'production'
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: parseTtlMs(env.REFRESH_TOKEN_TTL, 7 * 86_400_000),
  })
}

export function clearRefreshCookie(res: Response): void {
  const isProd = env.NODE_ENV === 'production'
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth',
  })
}
