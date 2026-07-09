import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticateToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'

const router: Router = Router()

router.get('/dashboard-admin', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const [
      citasPorEstado,
      pacientesPorMes,
      doctoresPorEspecialidad,
      horariosPorDoctor,
      horarioMasOcupado,
      pacientesCount,
      doctoresCount,
      especialidadesCount,
      horariosActivosCount,
    ] = await Promise.all([
      supabase.rpc('reporte_citas_por_estado'),
      supabase.rpc('reporte_pacientes_por_mes'),
      supabase.rpc('reporte_doctores_por_especialidad'),
      supabase.rpc('reporte_horarios_por_doctor'),
      supabase.rpc('reporte_horario_mas_ocupado_por_doctor'),
      supabase.from('paciente').select('id', { count: 'exact', head: true }),
      supabase.from('doctor').select('id', { count: 'exact', head: true }),
      supabase.from('especialidad').select('id', { count: 'exact', head: true }),
      supabase.from('horario_doctor').select('id', { count: 'exact', head: true }).eq('activo', true),
    ])

    for (const r of [citasPorEstado, pacientesPorMes, doctoresPorEspecialidad, horariosPorDoctor, horarioMasOcupado]) {
      if (r.error) throw r.error
    }

    const ESTADOS_ATENDIDOS = ['completada']
    const ESTADOS_PENDIENTES = ['programada', 'confirmada', 'en_curso']

    const sumaPorEstados = (estados: string[]) =>
      (citasPorEstado.data ?? [])
        .filter((r: any) => estados.includes(r.estado))
        .reduce((acc: number, r: any) => acc + Number(r.cantidad), 0)

    res.json({
      tarjetas: {
        pacientes_atendidos: sumaPorEstados(ESTADOS_ATENDIDOS),
        pacientes_pendientes: sumaPorEstados(ESTADOS_PENDIENTES),
        total_pacientes_registrados: pacientesCount.count ?? 0,
        total_doctores: doctoresCount.count ?? 0,
        total_especialidades: especialidadesCount.count ?? 0,
        total_horarios_activos: horariosActivosCount.count ?? 0,
      },
      citas_por_estado: citasPorEstado.data,
      pacientes_por_mes: pacientesPorMes.data,
      doctores_por_especialidad: doctoresPorEspecialidad.data,
      horarios_por_doctor: horariosPorDoctor.data,
      horario_mas_ocupado_por_doctor: horarioMasOcupado.data,
    })
  } catch (error: any) {
    console.error('Error Supabase:', error)
    res.status(500).json({ error: error.message ?? 'Error al obtener el dashboard' })
  }
})

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