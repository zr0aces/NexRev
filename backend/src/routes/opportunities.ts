import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { KanbanColumn, Opportunity } from '../types.js';
import { NotFoundError, OpportunityStore } from '../opportunity-store.js';

const store = new OpportunityStore();

function notFound(reply: FastifyReply) {
  return reply.code(404).send({ error: 'Not found' });
}

export const opportunityRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/opportunities', { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } }, async () => {
    return store.list();
  });

  fastify.get<{ Params: { id: string } }>('/opportunities/:id', async (req, reply) => {
    try {
      return await store.get(req.params.id);
    } catch (e) {
      if (e instanceof NotFoundError) return notFound(reply);
      throw e;
    }
  });

  fastify.post<{ Body: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'activities' | 'nextSteps'> }>(
    '/opportunities',
    async (req, reply) => {
      const opp = await store.create(req.body);
      return reply.code(201).send(opp);
    }
  );

  fastify.put<{ Params: { id: string }; Body: Partial<Opportunity> }>(
    '/opportunities/:id',
    async (req, reply) => {
      try {
        return await store.patch(req.params.id, req.body);
      } catch (e) {
        if (e instanceof NotFoundError) return notFound(reply);
        throw e;
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>('/opportunities/:id', async (req, reply) => {
    try {
      await store.delete(req.params.id);
      return reply.code(204).send();
    } catch (e) {
      if (e instanceof NotFoundError) return notFound(reply);
      throw e;
    }
  });

  fastify.post<{ Body: unknown[] }>(
    '/import',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!Array.isArray(req.body)) return reply.code(400).send({ error: 'Expected array' });
      if (req.body.length > 500) return reply.code(400).send({ error: 'Import batch too large (max 500)' });
      const result = await store.bulkImport(req.body);
      return { imported: result.created.length, skipped: result.skipped.length };
    }
  );

  fastify.post<{
    Params: { id: string };
    Body: { raw: string; summary?: string; ai: boolean; sf?: boolean };
  }>('/opportunities/:id/activities', async (req, reply) => {
    try {
      return await store.addActivity(req.params.id, req.body);
    } catch (e) {
      if (e instanceof NotFoundError) return notFound(reply);
      throw e;
    }
  });

  fastify.post<{ Params: { id: string }; Body: { text: string; column?: KanbanColumn } }>(
    '/opportunities/:id/steps',
    async (req, reply) => {
      try {
        return await store.upsertStep(req.params.id, null, {
          text: req.body.text,
          column: req.body.column,
        });
      } catch (e) {
        if (e instanceof NotFoundError) return notFound(reply);
        throw e;
      }
    }
  );

  fastify.patch<{
    Params: { id: string; index: string };
    Body: { done?: boolean; column?: KanbanColumn; text?: string };
  }>(
    '/opportunities/:id/steps/:index',
    async (req, reply) => {
      const index = parseInt(req.params.index, 10);
      if (isNaN(index)) return notFound(reply);
      try {
        return await store.upsertStep(req.params.id, index, req.body);
      } catch (e) {
        if (e instanceof NotFoundError) return notFound(reply);
        throw e;
      }
    }
  );

  fastify.delete<{ Params: { id: string; index: string } }>(
    '/opportunities/:id/steps/:index',
    async (req, reply) => {
      const index = parseInt(req.params.index, 10);
      if (isNaN(index)) return notFound(reply);
      try {
        return await store.removeStep(req.params.id, index);
      } catch (e) {
        if (e instanceof NotFoundError) return notFound(reply);
        throw e;
      }
    }
  );
};
