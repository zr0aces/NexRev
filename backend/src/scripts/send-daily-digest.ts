import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendDailyReminders } from '../notifications.js';
import { initDatabase } from '../db.js';

// Simple .env loader to keep a single source of truth
function loadEnv() {
  if (process.env.TELEGRAM_BOT_TOKEN) return;
  
  try {
    // When run from src/scripts/ (dev) or dist/scripts/ (prod)
    // we go up 3 levels to reach the root .env
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

async function run() {
  console.log('📦 Initializing environment...');
  // Ensure we point to the root data directory before loading modules that use it
  if (!process.env.DATA_DIR) {
    // If we're in the container, DATA_DIR is usually /app/data
    // If we're local, we look for ../../../data
    process.env.DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../data');
  }

  console.log('📦 Initializing database...');
  await initDatabase();
  
  console.log('🚀 Manually triggering Daily Telegram Digest...');
  await sendDailyReminders();
  console.log('✅ Finished manual execution.');
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Failed to send daily digest:', err);
  process.exit(1);
});
