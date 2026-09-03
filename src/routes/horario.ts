import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'
import { validateBody, validateParams } from '../lib/validate'
import {
  crearHorarioBodySchema,
  actualizarHorarioBodySchema,
  idParamSchema,
  doctorIdParamSchema,
  especialidadDoctorParamsSchema,
} from './horario.schema'
import {
  listarHorariosDeDoctor,
  crearHorarioHandler,
  actualizarHorarioHandler,
  horariosPorEspecialidadYDoctor,
} from './horario.controller'

const router: Router = Router()

router.get('/doctor/:doctorId', authenticateToken, requireRole(['admin']), validateParams(doctorIdParamSchema), listarHorariosDeDoctor)
router.post('/', authenticateToken, requireRole(['admin']), validateBody(crearHorarioBodySchema), crearHorarioHandler)
router.patch('/:id', authenticateToken, requireRole(['admin']), validateParams(idParamSchema), validateBody(actualizarHorarioBodySchema), actualizarHorarioHandler)
router.get('/:especialidadId/:doctorId', validateParams(especialidadDoctorParamsSchema), horariosPorEspecialidadYDoctor)

export default router
