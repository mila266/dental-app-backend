import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticateToken } from '../middleware/auth.js'
const router: Router = Router()

router.get('/', async (_req: Request, res: Response) => {
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
    console.error('Error Supabase', error);
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

// Buscar Cita por paciente

router.get('/paciente/:pacienteId', async (req: Request, res: Response) => {
  const { pacienteId } = req.params

  const { data, error } = await supabase
    .from('cita')
    .select(`
      id,fecha,hora_inicio,hora_fin,precio_cobrado,notas,
      doctor (id,nombre),
      servicio (id,nombre,duracion_minutos,especialidad (nombre,icono)),
      estado_cita (nombre,color_fondo,color_texto)
    `)
    .eq('paciente_id', pacienteId)
    .order('fecha', { ascending: false })

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

router.get('/ocupadas', async (req: Request, res: Response) => {
  const { doctor_id, fecha } = req.query

  if (!doctor_id || !fecha) {
    return res.status(400).json({ error: 'Faltan doctor_id o fecha' })
  }

  const { data, error } = await supabase
    .from('cita')
    .select(`
      hora_inicio, hora_fin,
      estado_cita!inner (nombre)
    `)
    .eq('doctor_id', doctor_id as string)
    .eq('fecha', fecha as string)
    .neq('estado_cita.nombre', 'cancelada')

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  const horarios = (data ?? []).map((c: any) => ({
    hora_inicio: c.hora_inicio,
    hora_fin: c.hora_fin,
  }))

  res.json(horarios)
})

router.get('/mias', authenticateToken, async (req: Request, res: Response) => {
  const paciente_id = req.user?.id
  const { doctor_id, especialidad_id } = req.query

  if (!paciente_id) {
    return res.status(401).json({ error: 'No autenticado' })
  }
  if (!doctor_id || !especialidad_id) {
    return res.status(400).json({ error: 'Faltan doctor_id o especialidad_id' })
  }

  const { data, error } = await supabase
    .from('cita')
    .select(`
      fecha,
      servicio!inner (especialidad_id),
      estado_cita!inner (nombre)
    `)
    .eq('paciente_id', paciente_id)
    .eq('doctor_id', doctor_id as string)
    .eq('servicio.especialidad_id', especialidad_id as string)
    .neq('estado_cita.nombre', 'cancelada')

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  const fechas = (data ?? []).map((c: any) => ({ fecha: c.fecha }))
  res.json(fechas)
})

// Ingresar nueva reserva de Cita

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const { doctor_id, servicio_id, consultorio_id, fecha, hora_inicio, hora_fin, notas } = req.body
  const paciente_id = req.user?.id

  if (!paciente_id || !doctor_id || !servicio_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Faltan datos para crear la cita' })
  }

  const evitarCitaDuplicadaenDiayDoctor = await supabase
    .from('cita')
    .select('id, fecha, hora_inicio')
    .eq('doctor_id', doctor_id)
    .eq('paciente_id', paciente_id)
    .eq('fecha', fecha)

  if (evitarCitaDuplicadaenDiayDoctor.data && evitarCitaDuplicadaenDiayDoctor.data.length > 0) {
    return res.status(409).json({
      code: "CITA_DUPLICADA",
      message: "Ya existe una cita para este doctor en la fecha seleccionada."
    })
  }

  // Buscar el estado initial: "programada"
  const { data: estadoInicial, error: errorEstado } = await supabase
    .from('estado_cita')
    .select('id')
    .eq('nombre', 'programada')
    .single()

  if (errorEstado || !estadoInicial) {
    console.error('Error obteniendo estado inicial:', errorEstado)
    return res.status(500).json({ error: 'No se encontró el estado inicial de cita' })
  }

  const { data, error } = await supabase
    .from('cita')
    .insert([{
      paciente_id,
      doctor_id,
      servicio_id,
      consultorio_id,
      fecha,
      hora_inicio: hora_inicio,
      hora_fin: hora_fin,
      notas,
      clinica_id: req.user?.clinica_id ?? null,
      estado_cita_id: estadoInicial.id,
    }])
    .select()

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ message: 'Cita creada', data })
})



export default router