import type { SupabaseClient } from '@supabase/supabase-js'

export type NuevaCita = {
  paciente_id: string
  doctor_id: string
  servicio_id: string
  consultorio_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  notas?: string
  clinica_id: string | null
}

export async function verificarCitaDuplicada(
  supabase: SupabaseClient,
  { doctorId, pacienteId, fecha }: { doctorId: string; pacienteId: string; fecha: string }
): Promise<boolean> {
  const { data, error } = await supabase
    .from('cita')
    .select('id, fecha, hora_inicio')
    .eq('doctor_id', doctorId)
    .eq('paciente_id', pacienteId)
    .eq('fecha', fecha)

  if (error) throw error
  return Boolean(data && data.length > 0)
}

export async function crearCita(supabase: SupabaseClient, nuevaCita: NuevaCita) {
  const { data: estadoInicial, error: errorEstado } = await supabase
    .from('estado_cita')
    .select('id')
    .eq('nombre', 'programada')
    .single()

  if (errorEstado || !estadoInicial) {
    throw new Error('No se encontró el estado inicial de cita')
  }

  const { data, error } = await supabase
    .from('cita')
    .insert([{ ...nuevaCita, estado_cita_id: estadoInicial.id }])
    .select()

  if (error) throw error
  return data
}
