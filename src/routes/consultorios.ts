import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router: Router = Router()

router.get('/', async (_req: Request, res: Response) => {
    const { data, error } = await supabase
        .from('consultorio')
        .select('id,clinica(id,nombre),nombre,tipo_consultorio(id,nombre)')

    if (error) {
        console.error('Error Supabase:', error)
        return res.status(500).json({ error: error.message })
    }
    res.json(data)

})

export default router

