import type { SupabaseClient } from '@supabase/supabase-js'

export type ErrorSolapamiento = { dia_semana: number; motivo: string }

export type ParametrosSolapamiento = {
  doctorId: string
  consultorioId: string
  diasSemana: number[]
  horaInicio: string
  horaFin: string
  fechaInicio: string
  fechaFin: string | null
}

// Valida, para cada día pedido, que no haya cruce de horario del propio doctor
// ni del consultorio con otro doctor. Devuelve la lista de días con conflicto
// (vacía si todo está libre) — el llamador decide qué hacer con eso.
export async function validarSolapamiento(
  supabase: SupabaseClient,
  { doctorId, consultorioId, diasSemana, horaInicio, horaFin, fechaInicio, fechaFin }: ParametrosSolapamiento
): Promise<ErrorSolapamiento[]> {
  const fechaFinFiltro = fechaFin ?? '9999-12-31'
  const errores: ErrorSolapamiento[] = []

  for (const dia of diasSemana) {
    // a) cruce contra el propio doctor, mismo día, sin importar consultorio
    const { data: cruceDoctor, error: errCruceDoctor } = await supabase
      .from('horario_doctor')
      .select('id, hora_inicio, hora_fin')
      .eq('doctor_id', doctorId)
      .eq('dia_semana', dia)
      .eq('activo', true)
      .lt('hora_inicio', horaFin)
      .gt('hora_fin', horaInicio)
      .lte('fecha_inicio', fechaFinFiltro)
      .or(`fecha_fin.is.null,fecha_fin.gte.${fechaInicio}`)

    if (errCruceDoctor) throw errCruceDoctor

    if (cruceDoctor && cruceDoctor.length > 0) {
      errores.push({
        dia_semana: dia,
        motivo: `El doctor ya tiene un horario que se cruza este día (${cruceDoctor[0].hora_inicio}-${cruceDoctor[0].hora_fin})`,
      })
      continue
    }

    // b) consultorio ocupado por OTRO doctor, mismo día, rango de fechas cruzado
    const { data: cruceConsultorio, error: errCruceConsultorio } = await supabase
      .from('horario_doctor')
      .select('id, hora_inicio, hora_fin, doctor:doctor_id(nombre)')
      .eq('consultorio_id', consultorioId)
      .eq('dia_semana', dia)
      .eq('activo', true)
      .neq('doctor_id', doctorId)
      .lt('hora_inicio', horaFin)
      .gt('hora_fin', horaInicio)
      .lte('fecha_inicio', fechaFinFiltro)
      .or(`fecha_fin.is.null,fecha_fin.gte.${fechaInicio}`)

    if (errCruceConsultorio) throw errCruceConsultorio

    if (cruceConsultorio && cruceConsultorio.length > 0) {
      const otro = cruceConsultorio[0] as any
      errores.push({
        dia_semana: dia,
        motivo: `El consultorio ya está en uso por Dr. ${otro.doctor?.nombre ?? 'otro doctor'} ese día (${otro.hora_inicio}-${otro.hora_fin}) dentro de ese rango de fechas`,
      })
    }
  }

  return errores
}
