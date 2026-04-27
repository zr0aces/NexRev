import type { FastifyPluginAsync } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

function extractText(msg: Anthropic.Message): string {
  const block = msg.content[0];
  if (!block || block.type !== 'text') throw new Error('Unexpected AI response format');
  return block.text;
}

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (_req, reply) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      return reply.code(400).send({ error: 'ANTHROPIC_API_KEY not configured on the server.' });
    }
  });

  fastify.post<{ Body: { raw: string } }>('/ai/summarize', async (req) => {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system:
        'You are a sales assistant. Given raw meeting or call notes, produce a concise structured summary with: 1) Key discussion points (2-3 bullets) 2) Decisions made 3) Action items. Keep it under 150 words. Plain text, no markdown headers, use dashes for bullets.',
      messages: [{ role: 'user', content: req.body.raw }],
    }) as Anthropic.Message;
    return { summary: extractText(msg) };
  });

  fastify.post<{
    Body: {
      oppName: string;
      stage: string;
      contact: string;
      recentActivities: string;
      nextStep: string;
    };
  }>('/ai/sf-note', async (req) => {
    const { oppName, stage, contact, recentActivities, nextStep } = req.body;
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system:
        'You are a Salesforce CRM assistant. Given recent sales activity notes, produce a Salesforce activity note in this exact format:\nDATE: [date]\nACTIVITY TYPE: [Call/Meeting/Email]\nSUMMARY: [1-2 sentences]\nNEXT STEP: [specific action, with date if known]\n\nUnder 80 words. Professional. CRM-ready.',
      messages: [
        {
          role: 'user',
          content: `Account: ${oppName}\nStage: ${stage}\nContact: ${contact || 'N/A'}\nRecent activities:\n${recentActivities}\nNext step on file: ${nextStep || 'None'}`,
        },
      ],
    }) as Anthropic.Message;
    return { note: extractText(msg) };
  });
};
