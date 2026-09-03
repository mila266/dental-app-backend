import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validarSolapamiento } from '../horario.service.js'

type QueryResult = { data: unknown; error: unknown }

function fakeSupabase(queue: QueryResult[]) {
  let i = 0
  return {
    from: () => {
      const builder: any = {}
      for (const m of ['select', 'eq', 'neq', 'lt', 'gt', 'lte', 'or']) {
        builder[m] = () => builder
      }
      builder.then = (resolve: (v: QueryResult) => unknown, reject: (e: unknown) => unknown) => {
        const result = queue[i] ?? { data: [], error: null }
        i += 1
        return Promise.resolve(result).then(resolve, reject)
      }
      return builder
    },
  } as any
}

const parametrosBase = {
  doctorId: 'doctor-1',
  consultorioId: 'consultorio-1',
  diasSemana: [1],
  horaInicio: '09:00',
  horaFin: '10:00',
  fechaInicio: '2026-01-01',
  fechaFin: null,
}

describe('validarSolapamiento', () => {
  test('sin conflictos, devuelve una lista vacía', async () => {
    const supabase = fakeSupabase([
      { data: [], error: null }, // cruce doctor
      { data: [], error: null }, // cruce consultorio
    ])

    const errores = await validarSolapamiento(supabase, parametrosBase)

    assert.deepEqual(errores, [])
  })

  test('detecta cruce contra el propio doctor y no sigue preguntando por el consultorio', async () => {
    const supabase = fakeSupabase([
      { data: [{ id: 'h1', hora_inicio: '08:30', hora_fin: '09:30' }], error: null },
    ])

    const errores = await validarSolapamiento(supabase, parametrosBase)

    assert.equal(errores.length, 1)
    assert.equal(errores[0].dia_semana, 1)
    assert.match(errores[0].motivo, /doctor ya tiene un horario/)
    assert.match(errores[0].motivo, /08:30-09:30/)
  })

  test('detecta cruce de consultorio con otro doctor', async () => {
    const supabase = fakeSupabase([
      { data: [], error: null }, // sin cruce propio
      { data: [{ id: 'h2', hora_inicio: '09:30', hora_fin: '10:30', doctor: { nombre: 'Carla Gómez' } }], error: null },
    ])

    const errores = await validarSolapamiento(supabase, parametrosBase)

    assert.equal(errores.length, 1)
    assert.match(errores[0].motivo, /Carla Gómez/)
  })

  test('propaga el error de Supabase en vez de tragárselo', async () => {
    const supabase = fakeSupabase([
      { data: null, error: { message: 'timeout de conexión' } },
    ])

    await assert.rejects(
      () => validarSolapamiento(supabase, parametrosBase),
      (err: any) => err.message === 'timeout de conexión'
    )
  })

  test('evalúa varios días, acumulando un error por cada uno que tenga conflicto', async () => {
    const supabase = fakeSupabase([
      { data: [], error: null },                                                   // día 1: sin cruce doctor
      { data: [], error: null },                                                   // día 1: sin cruce consultorio
      { data: [{ id: 'h3', hora_inicio: '09:00', hora_fin: '10:00' }], error: null }, // día 3: cruce doctor
    ])

    const errores = await validarSolapamiento(supabase, { ...parametrosBase, diasSemana: [1, 3] })

    assert.equal(errores.length, 1)
    assert.equal(errores[0].dia_semana, 3)
  })
})
