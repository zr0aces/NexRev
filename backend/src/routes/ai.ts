import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import * as storage from '../storage.js';
import { AiService, NoActivitiesError, verifyAiProviderAvailability } from '../ai-service.js';
import type { ActivityContext } from '../ai-service.js';

const service = new AiService();

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  const ensureProviderReady = async (reply: FastifyReply): Promise<FastifyReply | null> => {
    try {
      await verifyAiProviderAvailability();
      return null;
    } catch (err) {
      return reply.code(503).send({
        error: err instanceof Error ? err.message : 'AI provider is not available.',
      });
    }
  };

  const handleError = (e: unknown, reply: FastifyReply, route: string) => {
    console.error(`❌ Error in ${route}:`, e);
    if (e instanceof NoActivitiesError) return reply.code(422).send({ error: e.message });
    if (e instanceof Error) {
      if (e.message === 'Opportunity not found') return reply.code(404).send({ error: 'Not found' });
      if (e.message.includes('rate limit exceeded')) return reply.code(429).send({ error: e.message });
    }
    return reply.code(500).send({ 
      error: 'Internal server error', 
      details: e instanceof Error ? e.message : String(e) 
    });
  };

  fastify.post<{ Body: { raw: string; id: string } }>(
    '/ai/summarize',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const providerError = await ensureProviderReady(reply);
      if (providerError) return providerError;
      const { raw, id } = req.body ?? ({} as { raw?: string; id?: string });
      if (!id) return reply.code(400).send({ error: 'id is required' });
      if (!raw) return reply.code(400).send({ error: 'raw is required' });
      try {
        const opp = await storage.readOpportunity(id);
        const summary = await service.summarize(raw, opp);
        return { summary };
      } catch (e) {
        return handleError(e, reply, '/ai/summarize');
      }
    }
  );

  fastify.post<{ Body: { id: string; context?: ActivityContext } }>(
    '/ai/sf-note',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const providerError = await ensureProviderReady(reply);
      if (providerError) return providerError;
      const { id, context } = req.body ?? ({} as { id?: string; context?: ActivityContext });
      if (!id) return reply.code(400).send({ error: 'id is required' });
      try {
        const opp = await storage.readOpportunity(id);
        const note = await service.buildSfNote(opp, context);
        return { note };
      } catch (e) {
        return handleError(e, reply, '/ai/sf-note');
      }
    }
  );

  fastify.post<{ Body: { id: string; context?: ActivityContext } }>(
    '/ai/extract-tasks',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const providerError = await ensureProviderReady(reply);
      if (providerError) return providerError;
      const { id, context } = req.body ?? ({} as { id?: string; context?: ActivityContext });
      if (!id) return reply.code(400).send({ error: 'id is required' });
      try {
        const opp = await storage.readOpportunity(id);
        const tasks = await service.extractTasks(opp, context);
        const existing = new Set(opp.nextSteps.map(s => s.text));
        tasks.todo.filter(t => !existing.has(t)).forEach(t =>
          opp.nextSteps.push({ text: t, done: false, column: 'todo' }));
        tasks.followup.filter(t => !existing.has(t)).forEach(t =>
          opp.nextSteps.push({ text: t, done: false, column: 'followup' }));
        tasks.done.filter(t => !existing.has(t)).forEach(t =>
          opp.nextSteps.push({ text: t, done: true, column: 'done' }));
        await storage.writeOpportunity(opp);
        return opp;
      } catch (e) {
        return handleError(e, reply, '/ai/extract-tasks');
      }
    }
  );

  fastify.post<{ Body: { raw: string; id: string } }>(
    '/ai/process-activity',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const providerError = await ensureProviderReady(reply);
      if (providerError) return providerError;
      const { raw, id } = req.body ?? ({} as { raw?: string; id?: string });
      if (!id) return reply.code(400).send({ error: 'id is required' });
      if (!raw) return reply.code(400).send({ error: 'raw is required' });
      try {
        const opp = await storage.readOpportunity(id);
        const { summary, tasks } = await service.processActivity(raw, opp);
        const existing = new Set(opp.nextSteps.map(s => s.text));
        tasks.todo.filter(t => !existing.has(t)).forEach(t =>
          opp.nextSteps.push({ text: t, done: false, column: 'todo' }));
        tasks.followup.filter(t => !existing.has(t)).forEach(t =>
          opp.nextSteps.push({ text: t, done: false, column: 'followup' }));
        tasks.done.filter(t => !existing.has(t)).forEach(t =>
          opp.nextSteps.push({ text: t, done: true, column: 'done' }));
        await storage.writeOpportunity(opp);
        return { summary, opportunity: opp };
      } catch (e) {
        return handleError(e, reply, '/ai/process-activity');
      }
    }
  );
};
