import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'
import { validarSolapamiento } from './horario.service.js'

export async function listarHorariosDeDoctor(req: Request, res: Response) {
  const { doctorId } = req.params

  const { data, error } = await supabase
    .from('horario_doctor')
    .select('id,especialidad(id,nombre),consultorio(id,nombre),dia_semana,hora_inicio,hora_fin,activo')
    .eq('doctor_id', doctorId)
    .order('dia_semana', { ascending: true })

  if (error) {
    logger.error({ err: error }, 'Error Supabase en GET /api/horarios/doctor/:doctorId')
    return res.status(500).json({ error: error.message })
  }
  res.json(data)
}

export async function crearHorarioHandler(req: Request, res: Response) {
  const { especialidad_id, doctor_id, consultorio_id, dias_semana, hora_inicio, hora_fin, fecha_inicio, fecha_fin } = req.body

  if (!doctor_id || !especialidad_id || !consultorio_id || !hora_inicio || !hora_fin || !fecha_inicio) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios (incluyendo fecha_inicio)' })
  }

  if (!Array.isArray(dias_semana) || dias_semana.length === 0) {
    return res.status(400).json({ error: 'dias_semana debe ser un arreglo con al menos un día' })
  }
  if (dias_semana.some((d: number) => d < 1 || d > 7)) {
    return res.status(400).json({ error: 'Cada día debe estar entre 1 (lunes) y 7 (domingo)' })
  }
  if (hora_inicio >= hora_fin) {
    return res.status(400).json({ error: 'La hora de inicio debe ser menor a la hora de fin' })
  }
  if (fecha_fin && fecha_fin < fecha_inicio) {
    return res.status(400).json({ error: 'fecha_fin no puede ser anterior a fecha_inicio' })
  }

  // Verificar que el doctor realmente tenga esa especialidad asignada
  const { data: relacion, error: errorRelacion } = await supabase
    .from('doctor_especialidad')
    .select('id')
    .eq('doctor_id', doctor_id)
    .eq('especialidad_id', especialidad_id)
    .maybeSingle()

  if (errorRelacion) {
    logger.error({ err: errorRelacion }, 'Error Supabase verificando doctor_especialidad')
    return res.status(500).json({ error: errorRelacion.message })
  }
  if (!relacion) {
    return res.status(400).json({ error: 'Este doctor no tiene asignada esa especialidad' })
  }

  const errores = await validarSolapamiento(supabase, {
    doctorId: doctor_id,
    consultorioId: consultorio_id,
    diasSemana: dias_semana,
    horaInicio: hora_inicio,
    horaFin: hora_fin,
    fechaInicio: fecha_inicio,
    fechaFin: fecha_fin ?? null,
  })

  if (errores.length > 0) {
    return res.status(409).json({
      error: 'No se pudo asignar el horario. Ningún día fue guardado (todo o nada).',
      detalle: errores,
    })
  }

  // Todos los días pasaron -> insertamos una fila por día
  const filas = dias_semana.map((dia: number) => ({
    doctor_id,
    especialidad_id,
    consultorio_id,
    dia_semana: dia,
    hora_inicio,
    hora_fin,
    fecha_inicio,
    fecha_fin: fecha_fin ?? null,
  }))

  const { data, error } = await supabase
    .from('horario_doctor')
    .insert(filas)
    .select()

  if (error) {
    logger.error({ err: error }, 'Error Supabase insertando horario_doctor')
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json(data)
}

// valida citas afectadas antes de tocar el rango
export async function actualizarHorarioHandler(req: Request, res: Response) {
  const { id } = req.params
  const { activo, hora_inicio, hora_fin, consultorio_id, fecha_fin } = req.body

  // Caso simple: solo activar/desactivar, sin tocar rango -> no requiere validación de citas
  if (activo !== undefined && hora_inicio === undefined && hora_fin === undefined && consultorio_id === undefined) {
    const { data, error } = await supabase
      .from('horario_doctor')
      .update({ activo })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // Se está modificando el rango horario y/o el consultorio -> validar citas comprometidas
  const { data: horarioActual, error: errorActual } = await supabase
    .from('horario_doctor')
    .select('doctor_id, dia_semana, hora_inicio, hora_fin, consultorio_id, fecha_inicio, fecha_fin')
    .eq('id', id)
    .single()

  if (errorActual || !horarioActual) {
    return res.status(404).json({ error: 'Horario no encontrado' })
  }

  const nuevaHoraInicio = hora_inicio ?? horarioActual.hora_inicio
  const nuevaHoraFin = hora_fin ?? horarioActual.hora_fin

  // que caerían FUERA del nuevo rango [nuevaHoraInicio, nuevaHoraFin)
  const { data: citasAfectadas, error: errorCitas } = await supabase.rpc('citas_fuera_de_rango', {
    p_doctor_id: horarioActual.doctor_id,
    p_dia_semana: horarioActual.dia_semana,
    p_nueva_hora_inicio: nuevaHoraInicio,
    p_nueva_hora_fin: nuevaHoraFin,
  })

  if (errorCitas) {
    logger.error({ err: errorCitas }, 'Error Supabase en RPC citas_fuera_de_rango')
    return res.status(500).json({ error: errorCitas.message })
  }

  if (citasAfectadas && citasAfectadas.length > 0) {
    return res.status(409).json({
      error: 'Este cambio dejaría fuera citas ya agendadas. Coordina con el paciente antes de continuar.',
      citas_afectadas: citasAfectadas,
    })
  }

  const { data, error } = await supabase
    .from('horario_doctor')
    .update({ hora_inicio, hora_fin, consultorio_id, activo, fecha_fin })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
}

export async function horariosPorEspecialidadYDoctor(req: Request, res: Response) {
  const { especialidadId, doctorId } = req.params

  const { data, error } = await supabase
    .from('horario_doctor')
    .select('id,doctor(id,nombre),especialidad(id,nombre),consultorio(id,nombre),dia_semana,hora_inicio,hora_fin')
    .eq('especialidad_id', especialidadId)
    .eq('doctor_id', doctorId)
    .eq('activo', true)
    .order('dia_semana', { ascending: true })

  if (error) {
    logger.error({ err: error }, 'Error Supabase en GET /api/horarios/:especialidadId/:doctorId')
    return res.status(500).json({ error: error.message })
  }
  res.json(data)
}
