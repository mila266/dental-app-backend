import { z } from 'zod'

export const loginPersonalSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})

export const loginPacienteSchema = z.object({
  dni: z.string().min(1, 'El DNI es obligatorio'),
  fechaNacimiento: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
})

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['doctor', 'recepcionista', 'admin', 'contador'], { message: 'Rol inválido' }),
  doctor_id: z.string().optional(),
  clinica_id: z.string().optional(),
}).refine((data) => data.role !== 'doctor' || Boolean(data.doctor_id), {
  message: 'Falta doctor_id para usuario con rol doctor',
  path: ['doctor_id'],
})
