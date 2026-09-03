import type { Request, Response, NextFunction } from 'express'
import type { ZodType } from 'zod'

declare global {
  namespace Express {
    interface Request {
      // Express 5 vuelve `req.query` de solo lectura, así que validateQuery
      // no puede reasignarlo — el resultado parseado vive acá.
      validatedQuery?: Record<string, unknown>
    }
  }
}

function validationError(res: Response, result: { success: false; error: { issues: { path: (string | number)[]; message: string }[] } }) {
  return res.status(400).json({
    error: 'Datos inválidos',
    code: 'VALIDATION_ERROR',
    details: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  })
}

export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) return validationError(res, result)
    req.body = result.data
    next()
  }
}

export function validateParams(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params)
    if (!result.success) return validationError(res, result)
    req.params = result.data
    next()
  }
}

export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)
    if (!result.success) return validationError(res, result)
    req.validatedQuery = result.data
    next()
  }
}
