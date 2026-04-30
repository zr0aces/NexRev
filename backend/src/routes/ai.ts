import type { FastifyPluginAsync } from 'fastify';
import type { KanbanContext } from '../types.js';

const baseUrl = () => (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
const model   = () => process.env.OLLAMA_MODEL ?? 'llama3.2';

async function chat(system: string, user: string): Promise<string> {
  const res = await fetch(`${baseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model(),
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }
  const data = await res.json() as { message?: { content?: string }; error?: string };
  if (data.error) throw new Error(`Ollama: ${data.error}`);
  const content = data.message?.content;
  if (!content) throw new Error('Empty response from Ollama');
  return content;
}

function formatKanban(kanban: KanbanContext): string {
  const fmt = (items: string[]) => items.length ? items.map(t => `  • ${t}`).join('\n') : '  (none)';
  return [
    'Current board state for this account:',
    `To Do:\n${fmt(kanban.todo)}`,
    `Follow-ups pending:\n${fmt(kanban.followup)}`,
    `Completed:\n${fmt(kanban.done)}`,
  ].join('\n');
}

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

  fastify.post<{ Body: { raw: string; kanban?: KanbanContext } }>('/ai/summarize', async (req) => {
    const { raw, kanban } = req.body;
    const userContent = kanban ? `${raw}\n\n---\n${formatKanban(kanban)}` : raw;
    const summary = await chat(
      'You are a sales assistant. Given raw meeting or call notes (and optionally the current task board state), produce a concise structured summary with: 1) Key discussion points (2-3 bullets) 2) Decisions made 3) Action items — flag any board items that were discussed or resolved. Keep it under 150 words. Plain text, no markdown headers, use dashes for bullets.',
      userContent,
    );
    return { summary };
  });

  fastify.post<{
    Body: {
      oppName: string;
      stage: string;
      contact: string;
      recentActivities: string;
      nextStep: string;
      kanban?: KanbanContext;
    };
  }>('/ai/sf-note', async (req) => {
    const { oppName, stage, contact, recentActivities, nextStep, kanban } = req.body;
    const kanbanSection = kanban ? `\n${formatKanban(kanban)}` : '';
    const note = await chat(
      'You are a Salesforce CRM assistant. Given recent sales activity notes and the current task board, produce a Salesforce activity note in this exact format:\nDATE: [date]\nACTIVITY TYPE: [Call/Meeting/Email]\nSUMMARY: [1-2 sentences]\nNEXT STEP: [specific action, with date if known]\n\nUnder 80 words. Professional. CRM-ready.',
      `Account: ${oppName}\nStage: ${stage}\nContact: ${contact || 'N/A'}\nRecent activities:\n${recentActivities}\nNext step on file: ${nextStep || 'None'}${kanbanSection}`,
    );
    return { note };
  });

  fastify.post<{ Body: { activities: string } }>('/ai/extract-tasks', async (req) => {
    const { activities } = req.body;
    const prompt = `You are a sales assistant. Given recent sales activity notes, extract a list of specific action items or tasks for a Kanban board. 
Organize them into:
1) "todo" (tasks yet to be started)
2) "followup" (actions pending external response or specific follow-up dates)
3) "done" (tasks mentioned as completed)

Return ONLY a JSON object in this exact format:
{
  "todo": ["task 1", "task 2"],
  "followup": ["task 3"],
  "done": ["task 4"]
}
If no tasks are found for a category, return an empty array. No other text.`;

    const tasksJson = await chat(prompt, activities);
    try {
      const match = tasksJson.match(/\{[\s\S]*\}/);
      return JSON.parse(match ? match[0] : tasksJson);
    } catch (e) {
      throw new Error('Failed to parse AI task extraction result: ' + (e as Error).message);
    }
  });
};
