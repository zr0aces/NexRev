import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { 
  verifyCredentials, 
  signToken, 
  verifyToken,
  setTelegramChatId, 
  getUser, 
  updatePassword 
} from '../auth.js';
import { createLinkToken, getChatIdByToken } from '../notifications.js';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Extract and verify the username from the Authorization header.
 * Returns null and sends a 401 response when the token is missing or invalid.
 */
async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'Unauthorized' });
    return null;
  }
  try {
    const { username } = verifyToken(auth.slice(7));
    return username;
  } catch {
    await reply.code(401).send({ error: 'Invalid or expired token' });
    return null;
  }
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Strict rate limit for the login endpoint to prevent brute-force attacks
  await fastify.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({ error: 'Too many requests. Please try again later.' }),
  });

  fastify.post<{ Body: { username: string; password: string } }>(
    '/auth/login',
    async (req, reply) => {
      const { username, password } = req.body ?? {};
      if (!username || !password) {
        return reply.code(400).send({ error: 'Username and password required' });
      }
      const ok = await verifyCredentials(username, password);
      if (!ok) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }
      return { token: signToken(username), username };
    }
  );

  fastify.get('/auth/me', async (req, reply) => {
    const username = await requireAuth(req, reply);
    if (!username) return;

    const user = await getUser(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    
    return { 
      username: user.username, 
      telegram_chat_id: user.telegram_chat_id ?? null 
    };
  });

  fastify.post<{ Body: { password: string } }>(
    '/auth/password',
    async (req, reply) => {
      const username = await requireAuth(req, reply);
      if (!username) return;

      const { password } = req.body ?? {};
      if (!password) return reply.code(400).send({ error: 'Password required' });
      if (password.length < MIN_PASSWORD_LENGTH) {
        return reply.code(400).send({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }

      await updatePassword(username, password);
      return { ok: true };
    }
  );

  fastify.post<{ Body: { chatId: string | null } }>(
    '/auth/telegram',
    async (req, reply) => {
      const username = await requireAuth(req, reply);
      if (!username) return;

      const { chatId } = req.body ?? {};
      await setTelegramChatId(username, chatId);
      return { ok: true };
    }
  );

  fastify.get('/auth/telegram/link-token', async (req, reply) => {
    const username = await requireAuth(req, reply);
    if (!username) return;

    const token = createLinkToken();
    return { token, botName: process.env.TELEGRAM_BOT_NAME };
  });

  fastify.get<{ Querystring: { token: string } }>(
    '/auth/telegram/poll-link',
    async (req) => {
      const { token } = req.query;
      const chatId = getChatIdByToken(token);
      return { chatId };
    }
  );
};
