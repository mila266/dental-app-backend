import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'

const router: Router = Router()

router.get('/doctor/:doctorId', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { doctorId } = req.params

  const { data, error } = await supabase
    .from('horario_doctor')
    .select('id,especialidad(id,nombre),consultorio(id,nombre),dia_semana,hora_inicio,hora_fin,activo')
    .eq('doctor_id', doctorId)
    .order('dia_semana', { ascending: true })

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json(data)
})

router.post('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { especialidad_id, doctor_id, consultorio_id, dias_semana, hora_inicio, hora_fin, fecha_inicio, fecha_fin } = req.body

  if (!doctor_id || !especialidad_id || !consultorio_id || !hora_inicio || !hora_fin || !fecha_inicio) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios (incluyendo fecha_inicio)' })
  }

  if (!Array.isArray(dias_semana) || dias_semana.length === 0) {
    return res.status(400).json({ error: 'dias_semana debe ser un arreglo con al menos un día' })
  }
  if (dias_semana.some((d: number) => d < 1 || d > 7)) {
    return res.status(400).json({ error: 'Cada día debe estar entre 1 (lunes) y 7 (domingo)' })
  }
  if (hora_inicio >= hora_fin) {
    return res.status(400).json({ error: 'La hora de inicio debe ser menor a la hora de fin' })
  }
  if (fecha_fin && fecha_fin < fecha_inicio) {
    return res.status(400).json({ error: 'fecha_fin no puede ser anterior a fecha_inicio' })
  }

  // Verificar que el doctor realmente tenga esa especialidad asignada
  const { data: relacion, error: errorRelacion } = await supabase
    .from('doctor_especialidad')
    .select('id')
    .eq('doctor_id', doctor_id)
    .eq('especialidad_id', especialidad_id)
    .maybeSingle()

  if (errorRelacion) {
    console.error('Error Supabase:', errorRelacion)
    return res.status(500).json({ error: errorRelacion.message })
  }
  if (!relacion) {
    return res.status(400).json({ error: 'Este doctor no tiene asignada esa especialidad' })
  }

  const fechaFinFiltro = fecha_fin ?? '9999-12-31'

  const errores: { dia_semana: number; motivo: string }[] = []

  for (const dia of dias_semana) {
    // a) cruce contra el propio doctor, mismo día, sin importar consultorio
    const { data: cruceDoctor, error: errCruceDoctor } = await supabase
      .from('horario_doctor')
      .select('id, hora_inicio, hora_fin')
      .eq('doctor_id', doctor_id)
      .eq('dia_semana', dia)
      .eq('activo', true)
      .lt('hora_inicio', hora_fin)
      .gt('hora_fin', hora_inicio)
      .lte('fecha_inicio', fechaFinFiltro)
      .or(`fecha_fin.is.null,fecha_fin.gte.${fecha_inicio}`)

    if (errCruceDoctor) {
      console.error('Error Supabase:', errCruceDoctor)
      return res.status(500).json({ error: errCruceDoctor.message })
    }
    if (cruceDoctor && cruceDoctor.length > 0) {
      errores.push({
        dia_semana: dia,
        motivo: `El doctor ya tiene un horario que se cruza este día (${cruceDoctor[0].hora_inicio}-${cruceDoctor[0].hora_fin})`,
      })
      continue
    }

    // b) consultorio ocupado por OTRO doctor, mismo día, rango de fechas cruzado
    const { data: cruceConsultorio, error: errCruceConsultorio } = await supabase
      .from('horario_doctor')
      .select('id, hora_inicio, hora_fin, doctor:doctor_id(nombre)')
      .eq('consultorio_id', consultorio_id)
      .eq('dia_semana', dia)
      .eq('activo', true)
      .neq('doctor_id', doctor_id)
      .lt('hora_inicio', hora_fin)
      .gt('hora_fin', hora_inicio)
      .lte('fecha_inicio', fechaFinFiltro)
      .or(`fecha_fin.is.null,fecha_fin.gte.${fecha_inicio}`)

    if (errCruceConsultorio) {
      console.error('Error Supabase:', errCruceConsultorio)
      return res.status(500).json({ error: errCruceConsultorio.message })
    }
    if (cruceConsultorio && cruceConsultorio.length > 0) {
      const otro = cruceConsultorio[0] as any
      errores.push({
        dia_semana: dia,
        motivo: `El consultorio ya está en uso por Dr. ${otro.doctor?.nombre ?? 'otro doctor'} ese día (${otro.hora_inicio}-${otro.hora_fin}) dentro de ese rango de fechas`,
      })
    }
  }

  if (errores.length > 0) {
    return res.status(409).json({
      error: 'No se pudo asignar el horario. Ningún día fue guardado (todo o nada).',
      detalle: errores,
    })
  }

  // Todos los días pasaron -> insertamos una fila por día
  const filas = dias_semana.map((dia: number) => ({
    doctor_id,
    especialidad_id,
    consultorio_id,
    dia_semana: dia,
    hora_inicio,
    hora_fin,
    fecha_inicio,
    fecha_fin: fecha_fin ?? null,
  }))

  const { data, error } = await supabase
    .from('horario_doctor')
    .insert(filas)
    .select()

  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json(data)
})

// valida citas afectadas antes de tocar el rango

router.patch('/:id', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
  const { id } = req.params
  const { activo, hora_inicio, hora_fin, consultorio_id, fecha_fin } = req.body

  // Caso simple: solo activar/desactivar, sin tocar rango -> no requiere validación de citas
  if (activo !== undefined && hora_inicio === undefined && hora_fin === undefined && consultorio_id === undefined) {
    const { data, error } = await supabase
      .from('horario_doctor')
      .update({ activo })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json(data)
  }

  // Se está modificando el rango horario y/o el consultorio -> validar citas comprometidas
  const { data: horarioActual, error: errorActual } = await supabase
    .from('horario_doctor')
    .select('doctor_id, dia_semana, hora_inicio, hora_fin, consultorio_id, fecha_inicio, fecha_fin')
    .eq('id', id)
    .single()

  if (errorActual || !horarioActual) {
    return res.status(404).json({ error: 'Horario no encontrado' })
  }

  const nuevaHoraInicio = hora_inicio ?? horarioActual.hora_inicio
  const nuevaHoraFin = hora_fin ?? horarioActual.hora_fin


  // que caerían FUERA del nuevo rango [nuevaHoraInicio, nuevaHoraFin)
  const { data: citasAfectadas, error: errorCitas } = await supabase.rpc('citas_fuera_de_rango', {
    p_doctor_id: horarioActual.doctor_id,
    p_dia_semana: horarioActual.dia_semana,
    p_nueva_hora_inicio: nuevaHoraInicio,
    p_nueva_hora_fin: nuevaHoraFin,
  })

  if (errorCitas) {
    console.error('Error Supabase:', errorCitas)
    return res.status(500).json({ error: errorCitas.message })
  }

  if (citasAfectadas && citasAfectadas.length > 0) {
    return res.status(409).json({
      error: 'Este cambio dejaría fuera citas ya agendadas. Coordina con el paciente antes de continuar.',
      citas_afectadas: citasAfectadas,
    })
  }

  const { data, error } = await supabase
    .from('horario_doctor')
    .update({ hora_inicio, hora_fin, consultorio_id, activo, fecha_fin })
    .eq('id', id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json(data)
})

router.get('/:especialidadId/:doctorId', async (_req: Request, res: Response) => {

  const { especialidadId, doctorId } = _req.params;

  const { data, error } = await supabase
    .from('horario_doctor')
    .select('id,doctor(id,nombre),especialidad(id,nombre),consultorio(id,nombre),dia_semana,hora_inicio,hora_fin')
    .eq('especialidad_id', especialidadId)
    .eq('doctor_id', doctorId)
    .eq('activo', true)
    .order('dia_semana', { ascending: true })


  if (error) {
    console.error('Error Supabase:', error)
    return res.status(500).json({ error: error.message })
  }
  res.json(data)

})

export default router

