import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

import { env } from '../../lib/env.js'
import { supabase } from '../../lib/supabase.js'
import reportesRouter from '../reportes.js'

type Fixture = { data: unknown; error: null }

function fakeChain(result: Fixture) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'lte']) {
    builder[method] = () => builder
  }
  builder.then = (resolve: (v: Fixture) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/reportes', reportesRouter)
  return app
}

function contadorToken() {
  return jwt.sign(
    { sub: 'contador-1', role: 'contador', clinica_id: 'c1', tokenVersion: 0, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  )
}

const originalFrom = supabase.from.bind(supabase)

beforeEach(() => {
  supabase.from = (() => fakeChain({ data: [], error: null })) as unknown as typeof supabase.from
})

afterEach(() => {
  supabase.from = originalFrom
})

describe('GET /api/reportes/kpis-financieros (validación Zod)', () => {
  test('rechaza con 400 VALIDATION_ERROR si desde tiene formato inválido', async () => {
    const res = await request(buildApp())
      .get('/api/reportes/kpis-financieros')
      .query({ desde: '01-01-2026' })
      .set('Authorization', `Bearer ${contadorToken()}`)

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })

  test('acepta la request sin desde/hasta (son opcionales)', async () => {
    const res = await request(buildApp())
      .get('/api/reportes/kpis-financieros')
      .set('Authorization', `Bearer ${contadorToken()}`)

    assert.equal(res.status, 200)
  })
})
