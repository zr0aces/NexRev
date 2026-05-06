import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { 
  verifyCredentials, 
  signToken, 
  verifyToken,
  setTelegramChatId, 
  getUser, 
  updatePassword,
  listUsers
} from '../auth.js';
import { createLinkToken, getChatIdByToken } from '../notifications.js';
import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  generatePasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  listPasskeys,
  deletePasskey,
} from '../webauthn.js';

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
  fastify.post<{ Body: { username: string; password: string } }>(
    '/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const { username: rawUsername, password } = req.body ?? {};
      if (!rawUsername || !password) {
        return reply.code(400).send({ error: 'Username and password required' });
      }
      const username = rawUsername.toLowerCase();
      const ok = await verifyCredentials(username, password);
      if (!ok) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }
      return { token: signToken(username), username };
    }
  );

  fastify.get(
    '/auth/me',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
    const username = await requireAuth(req, reply);
    if (!username) return;

    const user = await getUser(username);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    
    return { 
      username: user.username, 
      telegram_chat_id: user.telegram_chat_id ?? null 
    };
  });

  fastify.get(
    '/auth/users',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const username = await requireAuth(req, reply);
      if (!username) return;
      return await listUsers();
    }
  );

  fastify.post<{ Body: { password: string } }>(
    '/auth/password',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
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
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const username = await requireAuth(req, reply);
      if (!username) return;

      const { chatId } = req.body ?? {};
      await setTelegramChatId(username, chatId);
      return { ok: true };
    }
  );

  fastify.get(
    '/auth/telegram/link-token',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      try {
        const username = await requireAuth(req, reply);
        if (!username) return;

        const token = createLinkToken();
        return { token, botName: process.env.TELEGRAM_BOT_NAME };
      } catch (err) {
        req.log.error(err);
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    });

  fastify.get<{ Querystring: { token?: string } }>(
    '/auth/telegram/poll-link',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => {
      const { token } = req.query;
      if (!token) return { chatId: null };
      const chatId = getChatIdByToken(token);
      return { chatId };
    }
  );

  // ── WebAuthn / Passkey routes ──────────────────────────────────────────────

  fastify.post<{ Body: { username: string } }>(
    '/auth/passkey/login-options',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { username: rawUsername } = req.body ?? {};
      if (!rawUsername) return reply.code(400).send({ error: 'Username required' });
      const username = rawUsername.toLowerCase();
      try {
        const options = await generatePasskeyAuthenticationOptions(username);
        return options;
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.post<{ Body: { username: string; response: AuthenticationResponseJSON } }>(
    '/auth/passkey/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { username: rawUsername, response } = req.body ?? {};
      if (!rawUsername || !response) {
        return reply.code(400).send({ error: 'Username and response required' });
      }
      const username = rawUsername.toLowerCase();
      try {
        const verified = await verifyPasskeyAuthentication(username, response);
        if (!verified) return reply.code(401).send({ error: 'Passkey authentication failed' });
        return { token: signToken(username), username };
      } catch (err) {
        return reply.code(401).send({ error: (err as Error).message });
      }
    }
  );

  fastify.post(
    '/auth/passkey/register-options',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const username = await requireAuth(req, reply);
      if (!username) return;
      try {
        const options = await generatePasskeyRegistrationOptions(username);
        return options;
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.post<{ Body: { response: RegistrationResponseJSON; name?: string } }>(
    '/auth/passkey/register',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const username = await requireAuth(req, reply);
      if (!username) return;
      const { response, name } = req.body ?? {};
      if (!response) return reply.code(400).send({ error: 'Response required' });
      try {
        const passkey = await verifyPasskeyRegistration(username, response, name ?? 'Passkey');
        return passkey;
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    }
  );

  fastify.get(
    '/auth/passkey/credentials',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const username = await requireAuth(req, reply);
      if (!username) return;
      return listPasskeys(username);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/auth/passkey/credentials/:id',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const username = await requireAuth(req, reply);
      if (!username) return;
      const { id } = req.params;
      const deleted = deletePasskey(username, id);
      if (!deleted) return reply.code(404).send({ error: 'Passkey not found' });
      return { ok: true };
    }
  );
};
