import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { listarCitas, misCitasCompletas, citasOcupadas, misCitas, crearCitaHandler } from './citas.controller.js'

const router: Router = Router()

router.get('/', authenticateToken, requireRole(['admin', 'recepcionista']), listarCitas)
router.get('/mias-completas', authenticateToken, misCitasCompletas)
router.get('/ocupadas', citasOcupadas)
router.get('/mias', authenticateToken, misCitas)
router.post('/', authenticateToken, crearCitaHandler)

export default router
