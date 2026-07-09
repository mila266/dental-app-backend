import { Router } from 'express'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { supabase } from '../lib/supabase'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'

const router: Router = Router()

router.get('/', async (_req: Request, res: Response) => {
    const { data, error } = await supabase
        .from('paciente')
        .select('id,clinica(id,nombre),nombre,email,telefono')

    if (error) {
        console.error('Error Supabase:', error)
        return res.status(500).json({ error: error.message })
    }
    res.json(data)
})

router.post('/login', async (req: Request, res: Response) => {
    const { dni, fechaNacimiento } = req.body

    if (!dni || !fechaNacimiento) {
        return res.status(400).json({ error: 'DNI y fecha de nacimiento son obligatorios' })
    }

    const { data, error } = await supabase
        .from('paciente')
        .select('id,clinica(id,nombre),nombre,email,telefono,fecha_nacimiento')
        .eq('dni', dni)
        .eq('fecha_nacimiento', fechaNacimiento)

    if (error) {
        console.error('Error Supabase:', error)
        return res.status(500).json({ error: error.message })
    }

    if (!Array.isArray(data) || data.length === 0) {
        return res.status(401).json({ error: 'DNI o fecha de nacimiento incorrectos' })
    }

    const resPaciente = data[0]

    if (!resPaciente) {
        return res.status(401).json({ error: 'DNI o fecha de nacimiento incorrectos' })
    }

    const clinica = Array.isArray(resPaciente.clinica)
        ? resPaciente.clinica[0]
        : resPaciente.clinica

    const token = jwt.sign(
        {
            id: resPaciente.id,
            nombre: resPaciente.nombre,
            email: resPaciente.email,
            role: 'paciente',
            clinica_id: clinica?.id,
        },
        process.env.JWT_SECRET || 'dentalapp-secret',
        { expiresIn: '8h' }
    )

    return res.json({
        id: resPaciente.id,
        nombre: resPaciente.nombre,
        email: resPaciente.email,
        telefono: resPaciente.telefono,
        clinica: resPaciente.clinica,
        token,
    })
})



router.get('/sesion', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dentalapp-secret') as { id: string; nombre: string; email?: string; role?: string }
    return res.json({ user: decoded })
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
})

router.post('/buscar-dni', async (req: Request, res: Response) => {
  const { dni, fechaNacimiento } = req.body

  if (!dni || !fechaNacimiento) {
    return res.status(400).json({ error: 'DNI y fecha son requeridos' })
  }

  const { data: paciente, error } = await supabase
    .from('paciente')
    .select('email, nombre, fecha_nacimiento')
    .eq('dni', dni)
    .eq('fecha_nacimiento', fechaNacimiento)
    .single()

  if (error || !paciente) {
    return res.status(401).json({ error: 'DNI o fecha de nacimiento incorrectos' })
  }

  res.json({ email: paciente.email, nombre: paciente.nombre })
})


router.get('/doctor/:doctorId/ocupacion', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { doctorId } = req.params

  const { data: horarios, error: errorHorarios } = await supabase
    .from('horario_doctor')
    .select('id, dia_semana, hora_inicio, hora_fin, consultorio(id,nombre), fecha_inicio, fecha_fin')
    .eq('doctor_id', doctorId)
    .eq('activo', true)
    .order('dia_semana', { ascending: true })

  if (errorHorarios) return res.status(500).json({ error: errorHorarios.message })

  const ESTADOS_PENDIENTES = ['programada', 'confirmada', 'en_curso']

  const resultado = await Promise.all(
    (horarios ?? []).map(async (h) => {
      const { count, error } = await supabase
        .from('cita')
        .select('id, estado_cita!inner(nombre)', { count: 'exact', head: true })
        .eq('doctor_id', doctorId)
        .gte('fecha', new Date().toISOString().split('T')[0])
        .gte('hora_inicio', h.hora_inicio)
        .lt('hora_inicio', h.hora_fin)
        .in('estado_cita.nombre', ESTADOS_PENDIENTES)

      return { ...h, citas_pendientes: error ? 0 : count ?? 0 }
    })
  )

  res.json(resultado)
})

export default router
