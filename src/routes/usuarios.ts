import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import bcrypt from 'bcryptjs'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'
import { requireActiveSession } from '../middleware/requireActiveSession'
import { signAccessToken, signRefreshToken, setRefreshCookie } from '../lib/tokens'
import { loginLimiter } from '../middleware/rateLimit'
import { validateBody } from '../lib/validate'
import { loginPersonalSchema, crearUsuarioSchema } from '../lib/schemas'

const router: Router = Router()

router.post('/', authenticateToken, requireActiveSession, requireRole(['admin']), validateBody(crearUsuarioSchema), async (req: Request, res: Response) => {
    const { nombre, email, password, role, doctor_id, clinica_id } = req.body

    const password_hash = await bcrypt.hash(password, 12)

    const { data, error } = await supabase
        .from('usuario')
        .insert([{ nombre, email, password_hash, role, doctor_id: doctor_id ?? null, clinica_id: clinica_id ?? null }])
        .select('id,nombre,email,role,doctor_id,clinica_id,activo,created_at')
        .single()

    if (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Ya existe un usuario con ese email' })
        }
        console.error('Error Supabase', error)
        return res.status(500).json({ error: error.message })
    }

    return res.status(201).json({ message: 'Usuario creado', data })
})

router.post('/login-personal', loginLimiter, validateBody(loginPersonalSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body

    const { data, error } = await supabase
        .from('usuario')
        .select('id,nombre,email,password_hash,role,doctor_id,clinica_id,activo,token_version')
        .eq('email', email)

    if (error) {
        console.error('Error Supabase:', error)
        return res.status(500).json({ error: error.message })
    }

    const usuario = data?.[0]

    if (!usuario) {
        return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash)

    if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales incorrectas' })
    }

    const token = signAccessToken({
        sub: usuario.id,
        role: usuario.role,
        clinica_id: usuario.clinica_id,
        tokenVersion: usuario.token_version,
    })

    setRefreshCookie(res, signRefreshToken({
        sub: usuario.id,
        role: usuario.role,
        tokenVersion: usuario.token_version,
    }))

    return res.json({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        role: usuario.role,
        doctor_id: usuario.doctor_id,
        token,
    })
})

export default router
