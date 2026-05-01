import cron from 'node-cron';
import { randomBytes } from 'crypto';
import { listOpportunities } from './storage.js';
import { getTelegramUsers } from './auth.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Token-to-ChatID mapping for automatic linking
const pendingLinks = new Map<string, string>();
let lastUpdateId = 0;

async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    if (!res.ok) {
      console.error(`Failed to send Telegram message to ${chatId}: ${res.statusText}`);
    }
  } catch (err) {
    console.error(`Error sending Telegram message:`, err);
  }
}

async function pollTelegramUpdates() {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as { ok: boolean, result: any[] };
    if (!data.ok) return;

    for (const update of data.result) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);
      const msg = update.message;
      if (!msg || !msg.text) continue;

      // Handle /start TOKEN
      if (msg.text.startsWith('/start ')) {
        const token = msg.text.split(' ')[1];
        if (token && pendingLinks.has(token)) {
          console.log(`🔗 Linked Telegram Chat ID ${msg.chat.id} to token ${token}`);
          pendingLinks.set(token, String(msg.chat.id));
          await sendTelegramMessage(String(msg.chat.id), '✅ <b>Success!</b> Your Telegram account has been linked to NexRev.');
        }
      }
    }
  } catch (err) {
    console.error('Error polling Telegram updates:', err);
  } finally {
    // Poll again immediately (Long Polling)
    setTimeout(pollTelegramUpdates, 1000);
  }
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

export function initNotifications() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set. Daily reminders will not be sent.');
    return;
  }

  // Start polling for /start commands (linking)
  pollTelegramUpdates();

  // Schedule for 8:30 AM every day
  cron.schedule('30 8 * * *', async () => {
    console.log('🔔 Running daily Telegram reminders at 08:30...');
    try {
      const opps = await listOpportunities();
      const users = await getTelegramUsers();

      if (users.length === 0) return;

      const today = new Date().toISOString().split('T')[0];
      const dueToday = opps.filter(o => o.followup === today);
      const overdue = opps.filter(o => o.followup && o.followup < today && o.stage !== 'Closed Won' && o.stage !== 'Closed Lost');

      if (dueToday.length === 0 && overdue.length === 0) {
        console.log('No reminders to send today.');
        return;
      }

      let message = `<b>🌅 NexRev Daily Digest</b>\n\n`;
      
      if (dueToday.length > 0) {
        message += `<b>📅 Due Today:</b>\n`;
        dueToday.forEach(o => {
          message += `• ${o.name} (${o.stage})\n`;
          if (o.nextStep) message += `  <i>Next: ${o.nextStep}</i>\n`;
        });
        message += `\n`;
      }

      if (overdue.length > 0) {
        message += `<b>⚠️ Overdue:</b>\n`;
        overdue.forEach(o => {
          const days = Math.floor((new Date(today).getTime() - new Date(o.followup).getTime()) / (1000 * 60 * 60 * 24));
          message += `• ${o.name} (${days}d overdue)\n`;
        });
      }

      message += `\n<a href="${process.env.APP_URL ?? 'http://localhost:8088'}">Open NexRev Dashboard</a>`;

      for (const user of users) {
        await sendTelegramMessage(user.telegram_chat_id, message);
      }
    } catch (err) {
      console.error('Error running daily reminders:', err);
    }
  });

  console.log('✅ Daily Telegram reminders scheduled for 08:30.');
}
