import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'

const router: Router = Router()

router.get('/especialidad/:especialidadId', async (req: Request, res: Response) => {
  const { especialidadId } = req.params

  const { data, error } = await supabase
    .from('doctor_especialidad')
    .select('id,doctor(id,nombre),especialidad(id,nombre)')
    .eq('especialidad_id', especialidadId)

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
})

router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('doctor')
    .select('*')

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json(data)

})

router.get('/:doctorId/especialidades', authenticateToken,requireRole(['admin']), async (req: Request, res: Response) => {
    const { doctorId } = req.params

    const { data, error } = await supabase
      .from('doctor_especialidad')
      .select('especialidad(id,nombre)')
      .eq('doctor_id', doctorId)

    if (error) {
      console.error('Error Supabase:', error)
      return res.status(500).json({ error: error.message })
    }

    const especialidades = data?.map(fila => fila.especialidad) ?? []
    res.json(especialidades)
  }
)

export default router

