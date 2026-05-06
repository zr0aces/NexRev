import fs, { existsSync, readFileSync } from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { initDatabase } from './db.js';
import { opportunityRoutes } from './routes/opportunities.js';
import { aiRoutes } from './routes/ai.js';
import { authRoutes } from './routes/auth.js';
import { initSecrets, verifyToken } from './auth.js';
import { initNotifications, stopNotifications } from './notifications.js';

// Simple .env loader to keep a single source of truth for Telegram/AI tokens
if (!process.env.TELEGRAM_BOT_TOKEN) {
  try {
    const rootEnvPath = path.join(process.cwd(), '..', '.env');
    if (fs.existsSync(rootEnvPath)) {
      const envContent = fs.readFileSync(rootEnvPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 1) return;
        const k = trimmed.slice(0, eqIdx).trim();
        if (!k || process.env[k]) return;
        let v = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding single or double quotes
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        process.env[k] = v;
      });
    }
  } catch (err) {
    console.warn('Could not auto-load .env fallback:', err);
  }
}

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

declare module 'fastify' {
  interface FastifyRequest {
    user?: { username: string };
  }
}

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
    const payload = verifyToken(auth.slice(7));
    request.user = payload;
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
      appVersion = (await fsPromises.readFile(p, 'utf8')).trim();
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
