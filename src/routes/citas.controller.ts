import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'
import { verificarCitaDuplicada, crearCita } from './citas.service.js'

export async function listarCitas(_req: Request, res: Response) {
  const { data, error } = await supabase
    .from('cita')
    .select(` id, fecha, hora_inicio, hora_fin, precio_cobrado, tiempo_real_fin, notas, created_at,
      clinica(id,nombre),
      paciente (id, nombre, email, telefono ),
      doctor (id, nombre, email ),
      servicio (id, nombre, duracion_minutos, precio_referencial,especialidad (id, nombre, icono)),
      consultorio (id, nombre, tipo_consultorio (nombre)),
      estado_cita (id, nombre, color_fondo, color_texto )`)
    .order('fecha', { ascending: false })

  if (error) {
    logger.error({ err: error }, 'Error Supabase en GET /api/citas')
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
}

export async function misCitasCompletas(req: Request, res: Response) {
  const paciente_id = req.user?.sub

  if (!paciente_id) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const { data, error } = await supabase
    .from('cita')
    .select(`
      id,fecha,hora_inicio,hora_fin,precio_cobrado,notas,
      doctor (id,nombre),
      servicio (id,nombre,duracion_minutos,especialidad (nombre,icono)),
      estado_cita (nombre,color_fondo,color_texto)
    `)
    .eq('paciente_id', paciente_id)
    .order('fecha', { ascending: false })

  if (error) {
    logger.error({ err: error }, 'Error Supabase en GET /api/citas/mias-completas')
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
}

export async function citasOcupadas(req: Request, res: Response) {
  const { doctor_id, fecha } = req.validatedQuery as { doctor_id: string; fecha: string }

  const { data, error } = await supabase
    .from('cita')
    .select(`
      hora_inicio, hora_fin,
      estado_cita!inner (nombre)
    `)
    .eq('doctor_id', doctor_id)
    .eq('fecha', fecha)
    .neq('estado_cita.nombre', 'cancelada')

  if (error) {
    logger.error({ err: error }, 'Error Supabase en GET /api/citas/ocupadas')
    return res.status(500).json({ error: error.message })
  }

  const horarios = (data ?? []).map((c: any) => ({
    hora_inicio: c.hora_inicio,
    hora_fin: c.hora_fin,
  }))

  res.json(horarios)
}

export async function misCitas(req: Request, res: Response) {
  const paciente_id = req.user?.sub
  const { doctor_id, especialidad_id } = req.validatedQuery as { doctor_id: string; especialidad_id: string }

  if (!paciente_id) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const { data, error } = await supabase
    .from('cita')
    .select(`
      fecha,
      servicio!inner (especialidad_id),
      estado_cita!inner (nombre)
    `)
    .eq('paciente_id', paciente_id)
    .eq('doctor_id', doctor_id)
    .eq('servicio.especialidad_id', especialidad_id)
    .neq('estado_cita.nombre', 'cancelada')

  if (error) {
    logger.error({ err: error }, 'Error Supabase en GET /api/citas/mias')
    return res.status(500).json({ error: error.message })
  }

  const fechas = (data ?? []).map((c: any) => ({ fecha: c.fecha }))
  res.json(fechas)
}

export async function crearCitaHandler(req: Request, res: Response) {
  const { doctor_id, servicio_id, consultorio_id, fecha, hora_inicio, hora_fin, notas } = req.body
  const paciente_id = req.user?.sub

  if (!paciente_id) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  const yaExiste = await verificarCitaDuplicada(supabase, { doctorId: doctor_id, pacienteId: paciente_id, fecha })

  if (yaExiste) {
    return res.status(409).json({
      code: 'CITA_DUPLICADA',
      message: 'Ya existe una cita para este doctor en la fecha seleccionada.',
    })
  }

  const data = await crearCita(supabase, {
    paciente_id,
    doctor_id,
    servicio_id,
    consultorio_id,
    fecha,
    hora_inicio,
    hora_fin,
    notas,
    clinica_id: req.user?.clinica_id ?? null,
  })

  res.status(201).json({ message: 'Cita creada', data })
}
