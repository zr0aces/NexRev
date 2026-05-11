import cron from 'node-cron';
import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { listOpportunities } from './storage.js';
import { getTelegramUsers } from './auth.js';
import { AiService } from './ai-service.js';


const ai = new AiService();
const DIGEST_CACHE_RETENTION_DAYS = 7;
const DIGEST_CACHE_PATTERN = /^daily-digest-(\d{4}-\d{2}-\d{2})\.txt$/;
const NON_RETRYABLE_TELEGRAM_STATUSES = new Set([400, 401, 403, 404]);

// Token-to-ChatID mapping for automatic linking
const pendingLinks = new Map<string, string>();
let lastUpdateId = 0;
let pollingActive = false;
let pollShutdownRequested = false;

interface TelegramMessage {
  text?: string;
  chat: { id: number };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramGetUpdatesResponse {
  ok: boolean;
  result: TelegramUpdate[];
}

// Telegram HTML only requires &, <, > to be escaped.
// Escaping " and ' is unnecessary and can corrupt Telegram entity parsing.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramMessage(chatId: string, text: string, retryCount = 2) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const attempt = async (parseMode?: string) => {
    // 15s timeout for message sending
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: parseMode
        }),
        signal: controller.signal
      });
      return res;
    } finally {
      clearTimeout(id);
    }
  };

  for (let i = 0; i <= retryCount; i++) {
    try {
      let res = await attempt('HTML');
      
      if (res.ok) return; // Success

      const errorData = await res.text();
      console.warn(`⚠️ Telegram API error (Attempt ${i+1}) for ${chatId}: ${errorData}`);

      // If it's a "Bad Request: can't parse entities", retry once without HTML
      if (errorData.includes('can\'t parse entities') || errorData.includes('bad_request')) {
        console.log(`🔄 Retrying without HTML formatting for ${chatId}...`);
        const fallbackRes = await attempt(undefined);
        if (fallbackRes.ok) return;
      }

      if (NON_RETRYABLE_TELEGRAM_STATUSES.has(res.status)) {
        throw new Error(`Telegram API rejected request with status ${res.status}: ${errorData}`);
      }
      
    } catch (err: any) {
      const isTimeout = err.name === 'AbortError' || err.code === 'ETIMEDOUT';
      console.error(`❌ Connection error (Attempt ${i+1}/${retryCount+1}) for ${chatId}:`, isTimeout ? 'Timeout' : err.message);
      
      if (i === retryCount) throw err; // Final attempt failed
      
      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function pollTelegramUpdates() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || pollShutdownRequested) return;
  pollingActive = true;
  const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
  try {
    // AbortSignal timeout slightly exceeds the Telegram server-side 30s hold
    const res = await fetch(url, { signal: AbortSignal.timeout(35000) });
    if (!res.ok) return;
    const data = await res.json() as TelegramGetUpdatesResponse;
    if (!data.ok) return;

    for (const update of data.result) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      const msg = update.message;
      if (!msg || !msg.text) continue;

      // Handle /start LINK_TOKEN
      if (msg.text.startsWith('/start ')) {
        const linkToken = msg.text.split(' ')[1];
        if (linkToken && pendingLinks.has(linkToken)) {
          console.log(`🔗 Linked Telegram Chat ID ${msg.chat.id} to token ${linkToken}`);
          pendingLinks.set(linkToken, String(msg.chat.id));
          await sendTelegramMessage(String(msg.chat.id), '✅ <b>Success!</b> Your Telegram account has been linked to NexRev.');
        }
      }
    }
  } catch (err) {
    console.error('Error polling Telegram updates:', err);
  } finally {
    pollingActive = false;
    if (!pollShutdownRequested) {
      // Poll again immediately (Long Polling)
      setTimeout(pollTelegramUpdates, 1000);
    }
  }
}

export function stopNotifications() {
  pollShutdownRequested = true;
}

export function createLinkToken(): string {
  const token = randomBytes(16).toString('hex');
  pendingLinks.set(token, ''); // Empty string means waiting
  // Expire after 5 minutes
  setTimeout(() => pendingLinks.delete(token), 5 * 60 * 1000);
  return token;
}

export function getChatIdByToken(token: string): string | null {
  const chatId = pendingLinks.get(token);
  return chatId || null;
}

function getReminderTimezone(): string {
  return process.env.REMINDER_TIMEZONE?.trim() || 'Asia/Bangkok';
}

function getCacheDir(): string {
  return path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), '..', 'data'));
}

async function ensureDigestCacheDir(): Promise<void> {
  await fs.mkdir(getCacheDir(), { recursive: true });
}

async function cleanupOldDigestCache(): Promise<void> {
  try {
    const entries = await fs.readdir(getCacheDir());
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DIGEST_CACHE_RETENTION_DAYS);

    await Promise.all(entries
      .filter((entry) => DIGEST_CACHE_PATTERN.test(entry))
      .map(async (entry) => {
        const match = entry.match(DIGEST_CACHE_PATTERN);
        if (!match) return;
        const fileDate = new Date(`${match[1]}T00:00:00Z`);
        if (Number.isNaN(fileDate.getTime()) || fileDate >= cutoff) return;
        await fs.unlink(path.join(getCacheDir(), entry)).catch(() => undefined);
      }));
  } catch (err) {
    console.warn('Failed to clean up digest cache:', err);
  }
}

export async function sendDailyReminders() {
  console.log('🔔 Running daily Telegram reminders...');
  try {
    const opps = await listOpportunities();
    const users = await getTelegramUsers();

    if (users.length === 0) {
      console.log('No users with linked Telegram found.');
      return;
    }

    const timezone = getReminderTimezone();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    const weekEnd = next7Days.toLocaleDateString('en-CA', { timeZone: timezone });

    const dueToday = opps.filter(o => o.followup === today);
    const overdue = opps.filter(o => o.followup && o.followup < today && o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');
    const upcomingWeek = opps.filter(o => o.followup > today && o.followup <= weekEnd && o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');

    if (dueToday.length === 0 && overdue.length === 0 && upcomingWeek.length === 0) {
      console.log('No reminders to send today.');
      return;
    }

    let message = '';
    await ensureDigestCacheDir();
    const cacheFile = path.join(getCacheDir(), `daily-digest-${today}.txt`);
    
    try {
      const cached = await fs.readFile(cacheFile, 'utf8').catch(() => null);
      if (cached) {
        console.log('📦 Reusing cached AI digest for today.');
        message = cached;
      } else {
        const rawMessage = await ai.generateDailyDigest({ dueToday, overdue, upcomingWeek });
        message = rawMessage;
        await fs.writeFile(cacheFile, message, 'utf8').catch(err => console.warn('Failed to cache digest:', err));
      }
    } catch (err) {
      console.error('AI digest generation failed, falling back to manual summary:', err);
      message = `<b>🌅 NexRev Daily Digest</b>\n\n`;
      
      if (dueToday.length > 0) {
        message += `<b>📅 Due Today:</b>\n`;
        dueToday.forEach(o => {
          message += `• ${escapeHtml(o.name)} (${escapeHtml(o.stage)})\n`;

        });
        message += `\n`;
      }

      if (overdue.length > 0) {
        message += `<b>⚠️ Overdue:</b>\n`;
        overdue.forEach(o => {
          const days = Math.floor((new Date(today).getTime() - new Date(o.followup).getTime()) / (1000 * 60 * 60 * 24));
          message += `• ${escapeHtml(o.name)} (${days}d overdue)\n`;
        });
        message += `\n`;
      }

      if (upcomingWeek.length > 0) {
        message += `<b>⏭️ Upcoming this Week:</b>\n`;
        upcomingWeek.forEach(o => {
          message += `• ${escapeHtml(o.name)} (Due: ${escapeHtml(o.followup)})\n`;
        });
      }
    }

    const dashboardUrl = process.env.APP_URL ?? 'http://localhost:8088';
    message += `\n\n<a href="${dashboardUrl}">Open NexRev Dashboard</a>`;

    for (const user of users) {
      try {
        await sendTelegramMessage(user.telegram_chat_id, message);
        console.log(`✅ Sent digest to user ${user.username} (${user.telegram_chat_id})`);
      } catch (err) {
        console.error(`❌ Failed to send digest to ${user.username} after all retries:`, err);
      }
    }
  } catch (err) {
    console.error('Error running daily reminders:', err);
  }
}

export function initNotifications() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set. Daily reminders will not be sent.');
    return;
  }

  void ensureDigestCacheDir().then(cleanupOldDigestCache);

  // Start polling for /start commands (linking)
  pollTelegramUpdates();

  // Schedule for 8:30 AM on weekdays (Mon-Fri; node-cron uses 1=Monday, 5=Friday)
  cron.schedule('30 8 * * 1-5', async () => {
    await sendDailyReminders();
  }, {
    timezone: getReminderTimezone()
  });

   console.log(`✅ Daily Telegram reminders scheduled for weekdays at 08:30 (${getReminderTimezone()}).`);
}
