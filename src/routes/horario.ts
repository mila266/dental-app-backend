import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'
import {
  listarHorariosDeDoctor,
  crearHorarioHandler,
  actualizarHorarioHandler,
  horariosPorEspecialidadYDoctor,
} from './horario.controller'

const router: Router = Router()

router.get('/doctor/:doctorId', authenticateToken, requireRole(['admin']), listarHorariosDeDoctor)
router.post('/', authenticateToken, requireRole(['admin']), crearHorarioHandler)
router.patch('/:id', authenticateToken, requireRole(['admin']), actualizarHorarioHandler)
router.get('/:especialidadId/:doctorId', horariosPorEspecialidadYDoctor)

export default router
