import fs from 'fs/promises';
import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { initDatabase } from './db.js';
import { opportunityRoutes } from './routes/opportunities.js';
import { aiRoutes } from './routes/ai.js';
import { authRoutes } from './routes/auth.js';
import { initSecrets, verifyToken } from './auth.js';
import { initNotifications, stopNotifications } from './notifications.js';

const server = Fastify({
  logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' },
});

await server.register(cors, {
  origin: process.env.NODE_ENV !== 'production',
});

// Global rate limiting — individual routes may override via config.rateLimit
await server.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({ error: 'Too many requests. Please try again later.' }),
});

server.addHook('onRequest', async (request, reply) => {
  const url = request.raw.url ?? '';
  if (
    url === '/api/health' ||
    url.startsWith('/api/auth/') ||
    request.method === 'OPTIONS'
  ) return;

  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  try {
    verifyToken(auth.slice(7));
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
});

await server.register(authRoutes, { prefix: '/api' });
await server.register(opportunityRoutes, { prefix: '/api' });
await server.register(aiRoutes, { prefix: '/api' });

let appVersion = 'unknown';
try {
  // Try looking in current directory, then one level up (root if started from backend/)
  const possiblePaths = [
    path.join(process.cwd(), 'VERSION'),
    path.join(process.cwd(), '..', 'VERSION')
  ];
  
  for (const p of possiblePaths) {
    try {
      appVersion = (await fs.readFile(p, 'utf8')).trim();
      break;
    } catch {
      continue;
    }
  }
} catch (e) {
  console.warn('Could not read VERSION file:', e);
}

server.get('/api/health', async () => ({ 
  status: 'ok', 
  version: appVersion,
  aiEnabled: !!process.env.OLLAMA_BASE_URL
}));

const dbInit = await initDatabase();
server.log.info(
  {
    schemaVersion: dbInit.schemaVersion,
    opportunitiesImported: dbInit.legacyMigration.opportunitiesImported,
    usersImported: dbInit.legacyMigration.usersImported,
    legacyFilesDeleted: dbInit.legacyMigration.legacyFilesDeleted,
    secretsFileDeleted: dbInit.legacyMigration.secretsFileDeleted,
  },
  'SQLite initialized'
);
await initSecrets();
initNotifications();

server.log.info({ version: appVersion }, 'NexRev System started');

const port = parseInt(process.env.PORT ?? '3001', 10);
await server.listen({ port, host: '0.0.0.0' });

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    stopNotifications();
    await server.close();
    process.exit(0);
  });
}
