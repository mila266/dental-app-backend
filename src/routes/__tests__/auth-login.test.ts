import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

import { env } from '../../lib/env.js'
import { supabase } from '../../lib/supabase.js'
import usuariosRouter from '../usuarios.js'
import pacientesRouter from '../pacientes.js'
import authRouter from '../auth.js'
import { authenticateToken } from '../../middleware/auth.js'
import { REFRESH_COOKIE_NAME } from '../../lib/tokens.js'

type Fixture = { data: unknown; error: null }

const fixtures: { usuario: Fixture; paciente: Fixture; usuarioInsert: Fixture } = {
  usuario: { data: [], error: null },
  paciente: { data: [], error: null },
  usuarioInsert: { data: [], error: null },
}

function fakeChain(selectResult: Fixture, insertResult?: Fixture) {
  const builder: Record<string, unknown> = {}
  let usedInsert = false
  const passthrough = ['select', 'eq', 'neq', 'gte', 'lt', 'in', 'order', 'update']
  for (const method of passthrough) {
    builder[method] = () => builder
  }
  builder.insert = () => { usedInsert = true; return builder }
  const resolveResult = () => (usedInsert && insertResult ? insertResult : selectResult)
  builder.single = () => Promise.resolve(resolveResult())
  builder.then = (resolve: (v: Fixture) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(resolveResult()).then(resolve, reject)
  return builder
}

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/api/auth', authRouter)
  app.use('/api/usuarios', usuariosRouter)
  app.use('/api/pacientes', pacientesRouter)
  return app
}

// Monkey-patch de supabase.from (singleton real) en vez de vi.mock: se restaura
// siempre en afterEach para no filtrar el fake entre tests.
const originalFrom = supabase.from.bind(supabase)

beforeEach(() => {
  fixtures.usuario = { data: [], error: null }
  fixtures.paciente = { data: [], error: null }
  fixtures.usuarioInsert = { data: [], error: null }

  supabase.from = ((table: string) => {
    if (table === 'usuario') return fakeChain(fixtures.usuario, fixtures.usuarioInsert)
    if (table === 'paciente') return fakeChain(fixtures.paciente)
    return fakeChain({ data: [], error: null })
  }) as unknown as typeof supabase.from
})

afterEach(() => {
  supabase.from = originalFrom
})

describe('POST /api/usuarios/login-personal', () => {
  test('emite un access token con el shape nuevo (sub, role, clinica_id, tokenVersion, type) y no filtra el hash', async () => {
    const password_hash = await bcrypt.hash('password123', 12)
    fixtures.usuario = {
      data: [{
        id: 'u1', nombre: 'Ana', email: 'ana@test.com', password_hash,
        role: 'admin', doctor_id: null, clinica_id: 'c1', activo: true, token_version: 3,
      }],
      error: null,
    }

    const res = await request(buildApp())
      .post('/api/usuarios/login-personal')
      .send({ email: 'ana@test.com', password: 'password123' })

    assert.equal(res.status, 200)
    assert.equal(res.body.password_hash, undefined)

    const decoded = jwt.verify(res.body.token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload
    assert.equal(decoded.sub, 'u1')
    assert.equal(decoded.role, 'admin')
    assert.equal(decoded.clinica_id, 'c1')
    assert.equal(decoded.tokenVersion, 3)
    assert.equal(decoded.type, 'access')

    const setCookie = res.headers['set-cookie']?.[0] ?? ''
    assert.ok(setCookie.includes(`${REFRESH_COOKIE_NAME}=`))
    assert.ok(setCookie.toLowerCase().includes('httponly'))
  })

  test('rechaza con mensaje genérico si la contraseña es incorrecta', async () => {
    const password_hash = await bcrypt.hash('password123', 12)
    fixtures.usuario = {
      data: [{ id: 'u1', nombre: 'Ana', email: 'ana@test.com', password_hash, role: 'admin', doctor_id: null, clinica_id: 'c1', activo: true, token_version: 0 }],
      error: null,
    }

    const res = await request(buildApp())
      .post('/api/usuarios/login-personal')
      .send({ email: 'ana@test.com', password: 'incorrecta' })

    assert.equal(res.status, 401)
    assert.equal(res.body.error, 'Credenciales incorrectas')
  })

  test('rechaza con el mismo mensaje genérico si el usuario no existe (no distingue el motivo)', async () => {
    const res = await request(buildApp())
      .post('/api/usuarios/login-personal')
      .send({ email: 'nadie@test.com', password: 'password123' })

    assert.equal(res.status, 401)
    assert.equal(res.body.error, 'Credenciales incorrectas')
  })

  test('rechaza con 400 VALIDATION_ERROR si el email tiene formato inválido', async () => {
    const res = await request(buildApp())
      .post('/api/usuarios/login-personal')
      .send({ email: 'no-es-un-email', password: 'password123' })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })

  test('bloquea con 429 RATE_LIMITED tras 8 intentos en la ventana para la misma cuenta', async () => {
    const app = buildApp()
    const email = 'rate-limit-test@test.com'

    let lastStatus = 0
    for (let i = 0; i < 9; i++) {
      const res = await request(app)
        .post('/api/usuarios/login-personal')
        .send({ email, password: 'password123' })
      lastStatus = res.status
    }

    assert.equal(lastStatus, 429)
  })
})

describe('POST /api/pacientes/login', () => {
  test('emite un access token con role=paciente y clinica_id/tokenVersion leídos de DB', async () => {
    fixtures.paciente = {
      data: [{
        id: 'p1', nombre: 'Juan', email: 'juan@test.com', telefono: '123',
        fecha_nacimiento: '1990-01-01', clinica: { id: 'c2', nombre: 'Clínica X' }, token_version: 1,
      }],
      error: null,
    }

    const res = await request(buildApp())
      .post('/api/pacientes/login')
      .send({ dni: '12345678', fechaNacimiento: '1990-01-01' })

    assert.equal(res.status, 200)
    const decoded = jwt.verify(res.body.token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload
    assert.equal(decoded.sub, 'p1')
    assert.equal(decoded.role, 'paciente')
    assert.equal(decoded.clinica_id, 'c2')
    assert.equal(decoded.tokenVersion, 1)
    assert.equal(decoded.type, 'access')
  })

  test('rechaza con mensaje genérico si no hay coincidencia de dni/fecha', async () => {
    const res = await request(buildApp())
      .post('/api/pacientes/login')
      .send({ dni: '00000000', fechaNacimiento: '2000-01-01' })

    assert.equal(res.status, 401)
    assert.equal(res.body.error, 'DNI o fecha de nacimiento incorrectos')
  })

  test('rechaza con 400 VALIDATION_ERROR si falta el dni', async () => {
    const res = await request(buildApp())
      .post('/api/pacientes/login')
      .send({ fechaNacimiento: '2000-01-01' })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })
})

describe('GET /api/pacientes/sesion', () => {
  test('devuelve el usuario decodificado del token vigente vía authenticateToken', async () => {
    const token = jwt.sign(
      { sub: 'p1', role: 'paciente', clinica_id: 'c2', tokenVersion: 1, type: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    )

    const res = await request(buildApp())
      .get('/api/pacientes/sesion')
      .set('Authorization', `Bearer ${token}`)

    assert.equal(res.status, 200)
    assert.partialDeepStrictEqual(res.body.user, { sub: 'p1', role: 'paciente', clinica_id: 'c2', tokenVersion: 1 })
  })
})

describe('authenticateToken', () => {
  test('devuelve 401 con code TOKEN_EXPIRED para un access token vencido', () => {
    const expired = jwt.sign(
      { sub: 'u1', role: 'admin', clinica_id: null, tokenVersion: 0, type: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -10 }
    )
    const req = { headers: { authorization: `Bearer ${expired}` } } as any
    let statusCode = 0
    let body: any
    const res = {
      status(code: number) { statusCode = code; return this },
      json(payload: any) { body = payload; return this },
    } as any

    authenticateToken(req, res, () => {})

    assert.equal(statusCode, 401)
    assert.equal(body.code, 'TOKEN_EXPIRED')
  })

  test('acepta un token válido e inyecta req.user con el shape nuevo', () => {
    const token = jwt.sign(
      { sub: 'u1', role: 'admin', clinica_id: 'c1', tokenVersion: 2, type: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    )
    const req = { headers: { authorization: `Bearer ${token}` } } as any
    const res = {} as any
    let nextCalled = false

    authenticateToken(req, res, () => { nextCalled = true })

    assert.equal(nextCalled, true)
    assert.partialDeepStrictEqual(req.user, { sub: 'u1', role: 'admin', clinica_id: 'c1', tokenVersion: 2 })
  })
})

describe('POST /api/auth/refresh', () => {
  test('emite un access token nuevo cuando el refresh token es válido y token_version coincide con DB', async () => {
    fixtures.usuario = { data: { id: 'u1', role: 'admin', clinica_id: 'c1', token_version: 5, activo: true }, error: null }
    const refreshToken = jwt.sign({ sub: 'u1', role: 'admin', tokenVersion: 5, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })

    const res = await request(buildApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${refreshToken}`])

    assert.equal(res.status, 200)
    const decoded = jwt.verify(res.body.token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload
    assert.equal(decoded.sub, 'u1')
    assert.equal(decoded.role, 'admin')
    assert.equal(decoded.clinica_id, 'c1')
    assert.equal(decoded.tokenVersion, 5)
  })

  test('rechaza con REFRESH_REVOKED si token_version en DB ya avanzó (logout o ban en otra sesión)', async () => {
    fixtures.usuario = { data: { id: 'u1', role: 'admin', clinica_id: 'c1', token_version: 6, activo: true }, error: null }
    const refreshToken = jwt.sign({ sub: 'u1', role: 'admin', tokenVersion: 5, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' })

    const res = await request(buildApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${refreshToken}`])

    assert.equal(res.status, 401)
    assert.equal(res.body.code, 'REFRESH_REVOKED')
  })

  test('rechaza con REFRESH_MISSING si no hay cookie de refresh', async () => {
    const res = await request(buildApp()).post('/api/auth/refresh')
    assert.equal(res.status, 401)
    assert.equal(res.body.code, 'REFRESH_MISSING')
  })

  test('rechaza con REFRESH_INVALID si la cookie no es un JWT válido', async () => {
    const res = await request(buildApp())
      .post('/api/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=esto-no-es-un-token`])

    assert.equal(res.status, 401)
    assert.equal(res.body.code, 'REFRESH_INVALID')
  })
})

describe('POST /api/auth/logout', () => {
  test('limpia la cookie de refresh y responde 204', async () => {
    fixtures.usuario = { data: { token_version: 5 }, error: null }
    const accessToken = jwt.sign(
      { sub: 'u1', role: 'admin', clinica_id: 'c1', tokenVersion: 5, type: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    )

    const res = await request(buildApp())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)

    assert.equal(res.status, 204)
    const setCookie = res.headers['set-cookie']?.[0] ?? ''
    assert.ok(setCookie.includes(`${REFRESH_COOKIE_NAME}=;`))
  })
})

describe('POST /api/usuarios (requireActiveSession)', () => {
  function adminToken(tokenVersion: number) {
    return jwt.sign(
      { sub: 'admin1', role: 'admin', clinica_id: 'c1', tokenVersion, type: 'access' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    )
  }

  const nuevoUsuario = { nombre: 'Nuevo', email: 'nuevo@test.com', password: 'password123', role: 'recepcionista' }

  test('crea el usuario cuando token_version del access token coincide con DB', async () => {
    fixtures.usuario = { data: { token_version: 5, activo: true }, error: null }
    fixtures.usuarioInsert = {
      data: { id: 'u2', nombre: 'Nuevo', email: 'nuevo@test.com', role: 'recepcionista', doctor_id: null, clinica_id: null, activo: true, created_at: '2026-01-01' },
      error: null,
    }

    const res = await request(buildApp())
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken(5)}`)
      .send(nuevoUsuario)

    assert.equal(res.status, 201)
  })

  test('rechaza con SESSION_REVOKED si el token_version del access token quedó desactualizado (logout/ban en otra sesión)', async () => {
    fixtures.usuario = { data: { token_version: 6, activo: true }, error: null }

    const res = await request(buildApp())
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken(5)}`)
      .send(nuevoUsuario)

    assert.equal(res.status, 401)
    assert.equal(res.body.code, 'SESSION_REVOKED')
  })

  test('rechaza con SESSION_REVOKED si la cuenta del admin fue desactivada', async () => {
    fixtures.usuario = { data: { token_version: 5, activo: false }, error: null }

    const res = await request(buildApp())
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken(5)}`)
      .send(nuevoUsuario)

    assert.equal(res.status, 401)
    assert.equal(res.body.code, 'SESSION_REVOKED')
  })

  test('rechaza con 400 VALIDATION_ERROR si el rol es inválido', async () => {
    fixtures.usuario = { data: { token_version: 5, activo: true }, error: null }

    const res = await request(buildApp())
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken(5)}`)
      .send({ ...nuevoUsuario, role: 'super-admin' })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })

  test('rechaza con 400 VALIDATION_ERROR si falta doctor_id para rol doctor', async () => {
    fixtures.usuario = { data: { token_version: 5, activo: true }, error: null }

    const res = await request(buildApp())
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken(5)}`)
      .send({ ...nuevoUsuario, role: 'doctor', doctor_id: undefined })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })
})
