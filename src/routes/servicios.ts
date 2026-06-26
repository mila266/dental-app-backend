import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router: Router = Router()

router.get('/', async (_req: Request, res: Response) => {
    const { data, error } = await supabase
        .from('servicio')
        .select('id,especialidad(id,nombre),nombre,duracion_minutos,descripcion,precio_referencial')

    if (error) {
        console.error('Error Supabase:', error)
        return res.status(500).json({ error: error.message })
    }
    res.json(data)

})

router.get('/especialidad/:especialidadId', async (req: Request, res: Response) => {
    const { especialidadId } = req.params

    const { data, error } = await supabase
        .from('servicio')
        .select('id,especialidad(id,nombre),nombre,duracion_minutos,descripcion,precio_referencial')
        .eq('especialidad_id', especialidadId)

    if (error) {
        console.error('Error Supabase:', error)
        return res.status(500).json({ error: error.message })
    }

    res.json(data)
})

export default router
