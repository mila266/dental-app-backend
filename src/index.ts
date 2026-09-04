import 'dotenv/config'
import { env } from './lib/env.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import authRouter from './routes/auth.js'
import citasRouter from './routes/citas.js'
import clinicasRouter from './routes/clinicas.js'
import consultoriosRouter from './routes/consultorios.js'
import doctoresRouter from './routes/doctores.js'
import especialidadesRouter from './routes/especialidades.js'
import horariosRouter from './routes/horario.js'
import pacientesRouter  from './routes/pacientes.js'
import serviciosRouter  from './routes/servicios.js'
import reportesRouter  from './routes/reportes.js'
import userRouter  from './routes/usuarios.js'
import { supabase } from './lib/supabase.js'
import { logger } from './lib/logger.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.CORS_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('CORS_NOT_ALLOWED'))
  },
  credentials: true,
}))
app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message === 'CORS_NOT_ALLOWED') {
    return res.status(403).json({ error: 'Origen no permitido', code: 'CORS_FORBIDDEN' })
  }
  return next(err)
})
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/citas', citasRouter)
app.use('/api/clinicas', clinicasRouter)
app.use('/api/consultorios', consultoriosRouter)
app.use('/api/doctores', doctoresRouter)
app.use('/api/especialidades', especialidadesRouter)
app.use('/api/horarios', horariosRouter)
app.use('/api/pacientes', pacientesRouter)
app.use('/api/servicios', serviciosRouter)
app.use('/api/reportes', reportesRouter)
app.use('/api/usuarios', userRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Error handler centralizado: captura lo que no se maneja en cada ruta
// (excepciones no controladas, promesas rechazadas )
// No reemplaza los `if (error) {...}` ya existentes en cada ruta.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Error no controlado')
  const status = typeof err?.status === 'number' ? err.status : 500
  res.status(status).json({ error: err?.message || 'Error interno del servidor' })
})

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`)
})
