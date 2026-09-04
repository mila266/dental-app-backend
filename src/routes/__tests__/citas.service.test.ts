import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { verificarCitaDuplicada, crearCita } from '../citas.service.js'

type QueryResult = { data: unknown; error: unknown }

function fakeSupabase(overrides: Record<string, QueryResult>) {
  return {
    from: (table: string) => {
      const result = overrides[table] ?? { data: [], error: null }
      const builder: any = {}
      for (const m of ['select', 'eq', 'insert']) {
        builder[m] = () => builder
      }
      builder.single = () => Promise.resolve(result)
      builder.then = (resolve: (v: QueryResult) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject)
      return builder
    },
  } as any
}

describe('verificarCitaDuplicada', () => {
  test('devuelve true si ya existe una cita para ese doctor/paciente/fecha', async () => {
    const supabase = fakeSupabase({
      cita: { data: [{ id: 'c1', fecha: '2026-01-01', hora_inicio: '09:00' }], error: null },
    })

    const resultado = await verificarCitaDuplicada(supabase, { doctorId: 'd1', pacienteId: 'p1', fecha: '2026-01-01' })

    assert.equal(resultado, true)
  })

  test('devuelve false si no hay coincidencias', async () => {
    const supabase = fakeSupabase({ cita: { data: [], error: null } })

    const resultado = await verificarCitaDuplicada(supabase, { doctorId: 'd1', pacienteId: 'p1', fecha: '2026-01-01' })

    assert.equal(resultado, false)
  })

  test('propaga el error de Supabase', async () => {
    const supabase = fakeSupabase({ cita: { data: null, error: { message: 'DB caída' } } })

    await assert.rejects(
      () => verificarCitaDuplicada(supabase, { doctorId: 'd1', pacienteId: 'p1', fecha: '2026-01-01' }),
      (err: any) => err.message === 'DB caída'
    )
  })
})

describe('crearCita', () => {
  test('busca el estado inicial "programada" e inserta la cita con ese estado_cita_id', async () => {
    const supabase = fakeSupabase({
      estado_cita: { data: { id: 'estado-programada' }, error: null },
      cita: { data: [{ id: 'nueva-cita', estado_cita_id: 'estado-programada' }], error: null },
    })

    const data = await crearCita(supabase, {
      paciente_id: 'p1', doctor_id: 'd1', servicio_id: 's1', consultorio_id: 'c1',
      fecha: '2026-01-01', hora_inicio: '09:00', hora_fin: '09:30', clinica_id: 'clin1',
    })

    assert.deepEqual(data, [{ id: 'nueva-cita', estado_cita_id: 'estado-programada' }])
  })

  test('lanza un error descriptivo si no encuentra el estado inicial', async () => {
    const supabase = fakeSupabase({
      estado_cita: { data: null, error: { message: 'no encontrado' } },
    })

    await assert.rejects(
      () => crearCita(supabase, {
        paciente_id: 'p1', doctor_id: 'd1', servicio_id: 's1', consultorio_id: 'c1',
        fecha: '2026-01-01', hora_inicio: '09:00', hora_fin: '09:30', clinica_id: null,
      }),
      (err: any) => err.message === 'No se encontró el estado inicial de cita'
    )
  })
})
