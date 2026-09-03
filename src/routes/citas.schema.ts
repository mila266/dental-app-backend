import { z } from 'zod'

export const crearCitaBodySchema = z.object({
  doctor_id: z.string().min(1),
  servicio_id: z.string().min(1),
  consultorio_id: z.string().min(1),
  fecha: z.string().min(1),
  hora_inicio: z.string().min(1),
  hora_fin: z.string().min(1),
  notas: z.string().optional(),
})

export const citasOcupadasQuerySchema = z.object({
  doctor_id: z.string().min(1),
  fecha: z.string().min(1),
})

export const misCitasQuerySchema = z.object({
  doctor_id: z.string().min(1),
  especialidad_id: z.string().min(1),
})
