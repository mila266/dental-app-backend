import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody, validateQuery } from '../lib/validate.js'
import { crearCitaBodySchema, citasOcupadasQuerySchema, misCitasQuerySchema } from './citas.schema.js'
import { listarCitas, misCitasCompletas, citasOcupadas, misCitas, crearCitaHandler } from './citas.controller.js'

const router: Router = Router()

router.get('/', authenticateToken, requireRole(['admin', 'recepcionista']), listarCitas)
router.get('/mias-completas', authenticateToken, misCitasCompletas)
router.get('/ocupadas', validateQuery(citasOcupadasQuerySchema), citasOcupadas)
router.get('/mias', authenticateToken, validateQuery(misCitasQuerySchema), misCitas)
router.post('/', authenticateToken, validateBody(crearCitaBodySchema), crearCitaHandler)

export default router
