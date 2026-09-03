import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

import { env } from '../../lib/env.js'
import { supabase } from '../../lib/supabase.js'
import especialidadesRouter from '../especialidades.js'

type Fixture = { data: unknown; error: null }

function fakeChain(result: Fixture) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'insert', 'update']) {
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
  app.use('/api/especialidades', especialidadesRouter)
  return app
}

function adminToken() {
  return jwt.sign(
    { sub: 'admin-1', role: 'admin', clinica_id: 'c1', tokenVersion: 0, type: 'access' },
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

describe('POST /api/especialidades (validación Zod)', () => {
  test('rechaza con 400 VALIDATION_ERROR si falta nombre', async () => {
    const res = await request(buildApp())
      .post('/api/especialidades')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ icono: 'tooth' })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })
})

describe('PATCH /api/especialidades/:id (validación Zod)', () => {
  test('rechaza con 400 VALIDATION_ERROR si el body viene vacío', async () => {
    const res = await request(buildApp())
      .patch('/api/especialidades/e1')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({})

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })
})
