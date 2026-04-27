import type { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import * as storage from '../storage.js';
import type { KanbanColumn, Opportunity } from '../types.js';

export const opportunityRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/opportunities', async () => {
    return storage.listOpportunities();
  });

  fastify.get<{ Params: { id: string } }>('/opportunities/:id', async (req, reply) => {
    try {
      return await storage.readOpportunity(req.params.id);
    } catch {
      return reply.code(404).send({ error: 'Not found' });
    }
  });

  fastify.post<{ Body: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'activities' | 'nextSteps'> }>(
    '/opportunities',
    async (req, reply) => {
      const now = new Date().toISOString();
      const opp: Opportunity = {
        ...req.body,
        id: nanoid(10),
        activities: [],
        nextSteps: [],
        createdAt: now,
        updatedAt: now,
      };
      await storage.writeOpportunity(opp);
      return reply.code(201).send(opp);
    }
  );

  fastify.put<{ Params: { id: string }; Body: Partial<Opportunity> }>(
    '/opportunities/:id',
    async (req, reply) => {
      try {
        const existing = await storage.readOpportunity(req.params.id);
        const updated: Opportunity = { ...existing, ...req.body, id: existing.id };
        await storage.writeOpportunity(updated);
        return updated;
      } catch {
        return reply.code(404).send({ error: 'Not found' });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>('/opportunities/:id', async (req, reply) => {
    try {
      await storage.deleteOpportunity(req.params.id);
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: 'Not found' });
    }
  });

  fastify.post<{ Body: Partial<Opportunity>[] }>('/import', async (req, reply) => {
    if (!Array.isArray(req.body)) return reply.code(400).send({ error: 'Expected array' });
    const existingIds = await storage.listIds();
    const now = new Date().toISOString();
    const toWrite: Opportunity[] = req.body
      .filter(item => item.id && !existingIds.has(item.id))
      .map(item => ({
        id: item.id!,
        name: item.name ?? 'Untitled',
        contact: item.contact ?? '',
        contactEmail: item.contactEmail ?? '',
        contactMobile: item.contactMobile ?? '',
        contactTitle: item.contactTitle ?? '',
        value: item.value ?? null,
        stage: item.stage ?? 'Prospecting',
        close: item.close ?? '',
        followup: item.followup ?? '',
        nextStep: item.nextStep ?? '',
        notes: item.notes ?? '',
        nextSteps: item.nextSteps ?? [],
        activities: (item.activities ?? []).map(a => ({ ...a, column: a.column ?? 'todo' })),
        createdAt: item.createdAt ?? now,
        updatedAt: item.updatedAt ?? now,
      }));
    await Promise.all(toWrite.map(opp => storage.writeOpportunity(opp)));
    return { imported: toWrite.length };
  });

  fastify.post<{
    Params: { id: string };
    Body: { raw: string; summary?: string; ai: boolean };
  }>('/opportunities/:id/activities', async (req, reply) => {
    try {
      const opp = await storage.readOpportunity(req.params.id);
      opp.activities.push({
        date: new Date().toISOString().split('T')[0],
        raw: req.body.raw,
        summary: req.body.summary,
        ai: req.body.ai,
        column: 'todo',
      });
      await storage.writeOpportunity(opp);
      return opp;
    } catch {
      return reply.code(404).send({ error: 'Not found' });
    }
  });

  fastify.patch<{ Params: { id: string; index: string }; Body: { column: KanbanColumn } }>(
    '/opportunities/:id/activities/:index',
    async (req, reply) => {
      try {
        const opp = await storage.readOpportunity(req.params.id);
        const idx = parseInt(req.params.index, 10);
        if (idx < 0 || idx >= opp.activities.length) {
          return reply.code(404).send({ error: 'Activity not found' });
        }
        opp.activities[idx].column = req.body.column ?? opp.activities[idx].column;
        await storage.writeOpportunity(opp);
        return opp;
      } catch {
        return reply.code(404).send({ error: 'Not found' });
      }
    }
  );

  fastify.post<{ Params: { id: string }; Body: { text: string } }>(
    '/opportunities/:id/steps',
    async (req, reply) => {
      try {
        const opp = await storage.readOpportunity(req.params.id);
        opp.nextSteps.push({ text: req.body.text, done: false });
        await storage.writeOpportunity(opp);
        return opp;
      } catch {
        return reply.code(404).send({ error: 'Not found' });
      }
    }
  );

  fastify.patch<{ Params: { id: string; index: string }; Body: { done: boolean } }>(
    '/opportunities/:id/steps/:index',
    async (req, reply) => {
      try {
        const opp = await storage.readOpportunity(req.params.id);
        const idx = parseInt(req.params.index, 10);
        if (idx < 0 || idx >= opp.nextSteps.length) return reply.code(404).send({ error: 'Step not found' });
        opp.nextSteps[idx].done = req.body.done;
        await storage.writeOpportunity(opp);
        return opp;
      } catch {
        return reply.code(404).send({ error: 'Not found' });
      }
    }
  );

  fastify.delete<{ Params: { id: string; index: string } }>(
    '/opportunities/:id/steps/:index',
    async (req, reply) => {
      try {
        const opp = await storage.readOpportunity(req.params.id);
        const idx = parseInt(req.params.index, 10);
        if (idx < 0 || idx >= opp.nextSteps.length) return reply.code(404).send({ error: 'Step not found' });
        opp.nextSteps.splice(idx, 1);
        await storage.writeOpportunity(opp);
        return opp;
      } catch {
        return reply.code(404).send({ error: 'Not found' });
      }
    }
  );
};
