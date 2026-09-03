import { z } from 'zod'

export const crearHorarioBodySchema = z
  .object({
    doctor_id: z.string().min(1),
    especialidad_id: z.string().min(1),
    consultorio_id: z.string().min(1),
    dias_semana: z.array(z.number().int().min(1).max(7)).min(1, 'dias_semana debe ser un arreglo con al menos un día'),
    hora_inicio: z.string().min(1),
    hora_fin: z.string().min(1),
    fecha_inicio: z.string().min(1),
    fecha_fin: z.string().min(1).nullish(),
  })
  .refine((data) => data.hora_inicio < data.hora_fin, {
    message: 'La hora de inicio debe ser menor a la hora de fin',
    path: ['hora_fin'],
  })
  .refine((data) => !data.fecha_fin || data.fecha_fin >= data.fecha_inicio, {
    message: 'fecha_fin no puede ser anterior a fecha_inicio',
    path: ['fecha_fin'],
  })

export const actualizarHorarioBodySchema = z.object({
  activo: z.boolean().optional(),
  hora_inicio: z.string().min(1).optional(),
  hora_fin: z.string().min(1).optional(),
  consultorio_id: z.string().min(1).optional(),
  fecha_fin: z.string().min(1).nullish(),
})

export const idParamSchema = z.object({
  id: z.string().min(1),
})

export const doctorIdParamSchema = z.object({
  doctorId: z.string().min(1),
})

export const especialidadDoctorParamsSchema = z.object({
  especialidadId: z.string().min(1),
  doctorId: z.string().min(1),
})
