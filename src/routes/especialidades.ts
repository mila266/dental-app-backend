import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'

const router: Router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('especialidad')
    .select('id,nombre,icono')
    .eq('activo', true)

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json(data)
})

router.get('/admin', authenticateToken, requireRole(['admin']), async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('especialidad')
    .select('id,nombre,icono,descripcion,activo')
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json(data)
})

router.post('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { nombre, icono, descripcion } = req.body

  if (!nombre || !icono) {
    return res.status(400).json({ error: 'nombre e icono son obligatorios' })
  }

  const { data, error } = await supabase
    .from('especialidad')
    .insert({ nombre, icono, descripcion: descripcion ?? null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una especialidad con ese nombre' })
    }
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json(data)
})

router.patch('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { id } = req.params
  const { nombre, icono, descripcion, activo } = req.body

  const cambios: Record<string, unknown> = {}
  if (nombre !== undefined) cambios.nombre = nombre
  if (icono !== undefined) cambios.icono = icono
  if (descripcion !== undefined) cambios.descripcion = descripcion
  if (activo !== undefined) cambios.activo = activo

  if (Object.keys(cambios).length === 0) {
    return res.status(400).json({ error: 'No enviaste ningún campo para actualizar' })
  }

  const { data, error } = await supabase
    .from('especialidad')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json(data)
})

export default router