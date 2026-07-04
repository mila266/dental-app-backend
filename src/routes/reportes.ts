import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router: Router = Router()

router.get('/kpis-financieros', authenticateToken, requireRole(['contador', 'admin']), async (req: Request, res: Response) => {
  const { desde, hasta } = req.query

  const { data, error } = await supabase
    .from('cita')
    .select('id, fecha, precio_cobrado, servicio(nombre), estado_cita(nombre)')
    .eq('estado_cita.nombre', 'completada')
    .gte('fecha', desde ?? '2026-01-01')
    .lte('fecha', hasta ?? new Date().toISOString().slice(0, 10))

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  const ingresoTotal = data.reduce((sum, c) => sum + (c.precio_cobrado ?? 0), 0)

  res.json({
    ingresoTotal,
    totalCitasCompletadas: data.length,
    citas: data,
  })
})

export default router