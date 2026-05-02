import type { FastifyPluginAsync } from 'fastify';
import * as storage from '../storage.js';
import { AiService, NoActivitiesError } from '../ai-service.js';
import type { ActivityContext } from '../ai-service.js';

const baseUrl = () => (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
const service = new AiService();

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (_req, reply) => {
    try {
      const res = await fetch(`${baseUrl()}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      return reply.code(503).send({
        error: `Ollama is not reachable at ${baseUrl()}. Ensure Ollama is running and OLLAMA_BASE_URL is correct.`,
      });
    }
  });

  fastify.post<{ Body: { raw: string; id: string } }>(
    '/ai/summarize',
    async (req, reply) => {
      try {
        const opp = await storage.readOpportunity(req.body.id);
        const summary = await service.summarize(req.body.raw, opp);
        return { summary };
      } catch (e) {
        if (e instanceof NoActivitiesError) return reply.code(422).send({ error: e.message });
        if (e instanceof Error && e.message === 'Opportunity not found') return reply.code(404).send({ error: 'Not found' });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  fastify.post<{ Body: { id: string; context?: ActivityContext } }>(
    '/ai/sf-note',
    async (req, reply) => {
      try {
        const opp = await storage.readOpportunity(req.body.id);
        const note = await service.buildSfNote(opp, req.body.context);
        return { note };
      } catch (e) {
        if (e instanceof NoActivitiesError) return reply.code(422).send({ error: e.message });
        if (e instanceof Error && e.message === 'Opportunity not found') return reply.code(404).send({ error: 'Not found' });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  fastify.post<{ Body: { id: string; context?: ActivityContext } }>(
    '/ai/extract-tasks',
    async (req, reply) => {
      try {
        const opp = await storage.readOpportunity(req.body.id);
        const tasks = await service.extractTasks(opp, req.body.context);
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
        if (e instanceof NoActivitiesError) return reply.code(422).send({ error: e.message });
        if (e instanceof Error && e.message === 'Opportunity not found') return reply.code(404).send({ error: 'Not found' });
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );
};
