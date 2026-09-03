import type { Request, Response, NextFunction } from 'express'
import type { ZodType } from 'zod'

export function validateBody(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_ERROR',
        details: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      })
    }
    req.body = result.data
    next()
  }
}
