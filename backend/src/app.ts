import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { InquiryRepository } from './repositories/inquiryRepository.js';
import { UserRepository } from './repositories/userRepository.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createInquiryRouter } from './routes/inquiryRoutes.js';

export interface AppDependencies {
  userRepo: UserRepository;
  inquiryRepo: InquiryRepository;
}

export function createApp({ userRepo, inquiryRepo }: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(userRepo));
  app.use('/api/inquiries', createInquiryRouter(inquiryRepo));

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Requested endpoint does not exist.',
      },
    });
  });

  app.use(errorHandler);

  return app;
}

