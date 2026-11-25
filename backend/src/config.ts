import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret =
  process.env.JWT_SECRET ??
  (nodeEnv === 'production'
    ? (() => {
        throw new Error('JWT_SECRET must be set in production.');
      })()
    : 'dev-change-this-secret-in-production-min-32-chars');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv,
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://app_user:app_password@localhost:5432/inquiry_db',
  jwtSecret,
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  sessionCookieName: 'cn_session',
};
