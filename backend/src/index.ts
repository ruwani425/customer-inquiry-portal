import { createApp } from './app.js';
import { config } from './config.js';
import { closePool, getPool } from './db/pool.js';
import { createPgInquiryRepository } from './repositories/inquiryRepository.js';
import { createPgUserRepository } from './repositories/userRepository.js';

const pool = getPool();
const app = createApp({
  userRepo: createPgUserRepository(pool),
  inquiryRepo: createPgInquiryRepository(pool),
});

const server = app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

