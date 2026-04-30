import type { FastifyPluginAsync } from 'fastify';
import { verifyCredentials, signToken } from '../auth.js';

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
};
