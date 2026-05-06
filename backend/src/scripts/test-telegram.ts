import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendTelegramMessage } from '../notifications.js';

// Simple .env loader to keep a single source of truth
function loadEnv() {
  if (process.env.TELEGRAM_BOT_TOKEN) return;
  
  try {
    const rootEnvPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
    if (fs.existsSync(rootEnvPath)) {
      const envContent = fs.readFileSync(rootEnvPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const k = key.trim();
          if (!process.env[k]) {
            process.env[k] = valueParts.join('=').trim();
          }
        }
      });
    }
  } catch (err: any) {
    console.warn('Could not auto-load .env from root:', err?.message);
  }
}

loadEnv();

const chatId = process.argv[2];
const message = process.argv[3] || 'Test message from NexRev Backend!';

if (!chatId) {
  console.error('Usage: npx tsx src/scripts/test-telegram.ts <chat_id> [message]');
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Error: TELEGRAM_BOT_TOKEN not found in environment.');
  process.exit(1);
}

console.log(`📡 Sending test message to ${chatId}...`);
sendTelegramMessage(chatId, message)
  .then(() => console.log('✅ Done.'))
  .catch(err => console.error('❌ Failed:', err));
