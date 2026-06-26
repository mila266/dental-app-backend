import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router: Router = Router()

router.get('/', async (_req: Request, res: Response) => {
    const { data, error } = await supabase
        .from('estado_cita')
        .select('id,nombre,descripcion,color_fondo,color_texto,orden')

    if (error) {
        console.error('Error Supabase:', error)
        return res.status(500).json({ error: error.message })
    }
    res.json(data)

})

export default router
