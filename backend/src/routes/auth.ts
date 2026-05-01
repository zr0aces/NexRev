import type { FastifyPluginAsync } from 'fastify';
import { 
  verifyCredentials, 
  signToken, 
  setTelegramChatId, 
  getUser, 
  updatePassword 
} from '../auth.js';
import { createLinkToken, getChatIdByToken } from '../notifications.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
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
    const auth = req.headers.authorization;
    if (!auth) return reply.code(401).send({ error: 'Unauthorized' });
    const token = auth.slice(7);
    const { username } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
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
      const auth = req.headers.authorization;
      if (!auth) return reply.code(401).send({ error: 'Unauthorized' });
      const token = auth.slice(7);
      const { username } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      const { password } = req.body ?? {};
      if (!password) return reply.code(400).send({ error: 'Password required' });
      
      await updatePassword(username, password);
      return { ok: true };
    }
  );

  fastify.post<{ Body: { chatId: string | null } }>(
    '/auth/telegram',
    async (req, reply) => {
      const auth = req.headers.authorization;
      if (!auth) return reply.code(401).send({ error: 'Unauthorized' });
      const token = auth.slice(7);
      const { username } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      
      const { chatId } = req.body ?? {};
      await setTelegramChatId(username, chatId);
      return { ok: true };
    }
  );

  fastify.get('/auth/telegram/link-token', async () => {
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
