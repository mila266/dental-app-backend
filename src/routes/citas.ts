import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
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

router.post('/', async (req: Request, res: Response) => {
  const { clinica_id, paciente_id, doctor_id, servicio_id, consultorio_id, estado_cita_id, fecha, hora_inicio, hora_fin, precio_cobrado, notas } = req.body

  const { data, error } = await supabase
    .from('cita')
    .insert([{ clinica_id, paciente_id, doctor_id, servicio_id, consultorio_id, estado_cita_id, fecha, hora_inicio, hora_fin, precio_cobrado, notas }])
    .select()

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ message: 'Cita creada', data })
})



export default router