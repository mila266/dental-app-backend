import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`[env] Falta la variable de entorno obligatoria: ${name}`)
    process.exit(1)
  }
  return value
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback
}

export const env = {
  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_KEY: required('SUPABASE_KEY'),
  PORT: optional('PORT', '3000'),
  ACCESS_TOKEN_TTL: optional('ACCESS_TOKEN_TTL', '15m'),
  REFRESH_TOKEN_TTL: optional('REFRESH_TOKEN_TTL', '7d'),
  CORS_ALLOWED_ORIGINS: optional('CORS_ALLOWED_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  NODE_ENV: optional('NODE_ENV', 'development'),
}
