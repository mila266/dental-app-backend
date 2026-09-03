import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'

import { env } from '../../lib/env.js'
import { supabase } from '../../lib/supabase.js'
import horarioRouter from '../horario.js'

type Fixture = { data: unknown; error: null }

function fakeChain(result: Fixture) {
  const builder: Record<string, unknown> = {}
  const passthrough = ['select', 'eq', 'neq', 'gt', 'lt', 'lte', 'or', 'order', 'insert', 'update']
  for (const method of passthrough) {
    builder[method] = () => builder
  }
  builder.single = () => Promise.resolve(result)
  builder.maybeSingle = () => Promise.resolve(result)
  builder.then = (resolve: (v: Fixture) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/horarios', horarioRouter)
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

const bodyBase = {
  doctor_id: 'd1',
  especialidad_id: 'e1',
  consultorio_id: 'c1',
  dias_semana: [1],
  hora_inicio: '09:00',
  hora_fin: '10:00',
  fecha_inicio: '2026-01-01',
}

describe('POST /api/horarios (validación Zod)', () => {
  test('rechaza con 400 VALIDATION_ERROR si dias_semana está vacío', async () => {
    const res = await request(buildApp())
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...bodyBase, dias_semana: [] })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })

  test('rechaza con 400 VALIDATION_ERROR si un día está fuera de 1-7', async () => {
    const res = await request(buildApp())
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...bodyBase, dias_semana: [8] })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })

  test('rechaza con 400 VALIDATION_ERROR si hora_inicio no es menor a hora_fin', async () => {
    const res = await request(buildApp())
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ ...bodyBase, hora_inicio: '11:00', hora_fin: '10:00' })

    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
  })
})
