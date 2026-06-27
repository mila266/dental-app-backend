import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router: Router = Router()

router.get('/:especialidadId/:doctorId', async (_req: Request, res: Response) => {

    const {especialidadId, doctorId} = _req.params;

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

