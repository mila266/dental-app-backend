import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

import { env } from '../../lib/env.js'
import { supabase } from '../../lib/supabase.js'
import citasRouter from '../citas.js'

type Fixture = { data: unknown; error: null }

const fixtures: { cita: Fixture } = {
  cita: { data: [], error: null },
}

function fakeChain(result: Fixture) {
  const builder: Record<string, unknown> = {}
  const passthrough = ['select', 'eq', 'neq', 'gte', 'lt', 'in', 'order', 'insert', 'update']
  for (const method of passthrough) {
    builder[method] = () => builder
  }
  builder.single = () => Promise.resolve(result)
  builder.then = (resolve: (v: Fixture) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/citas', citasRouter)
  return app
}

function tokenFor(role: string, sub = 'user-1') {
  return jwt.sign(
    { sub, role, clinica_id: 'c1', tokenVersion: 0, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  )
}

const originalFrom = supabase.from.bind(supabase)

beforeEach(() => {
  fixtures.cita = { data: [], error: null }
  supabase.from = ((table: string) => {
    if (table === 'cita') return fakeChain(fixtures.cita)
    return fakeChain({ data: [], error: null })
  }) as unknown as typeof supabase.from
})

afterEach(() => {
  supabase.from = originalFrom
})

describe('GET /api/citas (listado completo)', () => {
  test('rechaza sin token', async () => {
    const res = await request(buildApp()).get('/api/citas')
    assert.equal(res.status, 401)
  })

  test('rechaza a un paciente autenticado (no es admin/recepcionista)', async () => {
    const res = await request(buildApp())
      .get('/api/citas')
      .set('Authorization', `Bearer ${tokenFor('paciente')}`)

    assert.equal(res.status, 403)
  })

  test('permite el acceso a un admin', async () => {
    fixtures.cita = { data: [{ id: 'cita-1' }], error: null }

    const res = await request(buildApp())
      .get('/api/citas')
      .set('Authorization', `Bearer ${tokenFor('admin')}`)

    assert.equal(res.status, 200)
    assert.deepEqual(res.body, [{ id: 'cita-1' }])
  })

  test('permite el acceso a recepcionista', async () => {
    const res = await request(buildApp())
      .get('/api/citas')
      .set('Authorization', `Bearer ${tokenFor('recepcionista')}`)

    assert.equal(res.status, 200)
  })
})

describe('GET /api/citas/mias-completas', () => {
  test('rechaza sin token', async () => {
    const res = await request(buildApp()).get('/api/citas/mias-completas')
    assert.equal(res.status, 401)
  })

  test('devuelve las citas del paciente autenticado (según el sub del token, no un param de URL)', async () => {
    fixtures.cita = { data: [{ id: 'cita-1', fecha: '2026-01-01' }], error: null }

    const res = await request(buildApp())
      .get('/api/citas/mias-completas')
      .set('Authorization', `Bearer ${tokenFor('paciente', 'paciente-42')}`)

    assert.equal(res.status, 200)
    assert.deepEqual(res.body, [{ id: 'cita-1', fecha: '2026-01-01' }])
  })
})
