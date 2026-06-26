import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router: Router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const { data, error} = await supabase
    .from('especialidad')
    .select('id,nombre, icono')

    if (error) {
      console.error('Error Supabase:', error)
      return res.status(500).json({ error: error.message })
    }
    res.json(data)
    
  })
  
  export default router
  