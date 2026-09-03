import { Router } from 'express'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import bcrypt from 'bcryptjs'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'
import { signAccessToken, signRefreshToken, setRefreshCookie } from '../lib/tokens'

const router: Router = Router()

router.post('/', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    const { nombre, email, password, role, doctor_id, clinica_id } = req.body

    if (!nombre || !email || !password || !role) {
        return res.status(400).json({ error: "Faltan completar campos obligatorios" })
    }

    if (password.length < 8) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" })
    }

    const rolesValidos = ['doctor', 'recepcionista', 'admin', 'contador']
    if (!rolesValidos.includes(role)) {
        return res.status(400).json({ error: "Rol inválido" })
    }

    if (role === 'doctor' && !doctor_id) {
        return res.status(400).json({ error: "Falta doctor_id para usuario con rol doctor" })
    }

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

router.post('/login-personal', async (req: Request, res: Response) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son obligatorios' })
    }

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
