import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase'

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

    return res.json({
        id: resPaciente.id,
        nombre: resPaciente.nombre,
        email: resPaciente.email,
        telefono: resPaciente.telefono,
        clinica: resPaciente.clinica,
    })
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


export default router

