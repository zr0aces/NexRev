import fs from 'fs/promises';
import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ensureDataDir } from './storage.js';
import { opportunityRoutes } from './routes/opportunities.js';
import { aiRoutes } from './routes/ai.js';
import { authRoutes } from './routes/auth.js';
import { initSecrets, verifyToken } from './auth.js';
import { initNotifications } from './notifications.js';

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
    url === '/health' ||
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
  appVersion = (await fs.readFile(path.join(process.cwd(), 'VERSION'), 'utf8')).trim();
} catch (e) {
  console.warn('Could not read VERSION file:', e);
}

server.get('/api/health', async () => ({ status: 'ok', version: appVersion }));

await ensureDataDir();
await initSecrets();
initNotifications();

const port = parseInt(process.env.PORT ?? '3001', 10);
await server.listen({ port, host: '0.0.0.0' });
