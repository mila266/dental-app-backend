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

// Ingresar nueva reserva de Cita

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const { doctor_id, servicio_id, fecha, hora, notas } = req.body
  const paciente_id = req.user?.id

  if (!paciente_id || !doctor_id || !servicio_id || !fecha || !hora) {
    return res.status(400).json({ error: 'Faltan datos para crear la cita' })
  }

  // Buscar el estado inicial: "programada"
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
      fecha,
      hora_inicio: hora,
      hora_fin: hora,
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