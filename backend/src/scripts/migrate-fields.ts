import { initDatabase, getDb } from '../db.js';
import { OpportunityStore } from '../opportunity-store.js';

async function migrate() {
  console.log('🚀 Initializing database...');
  await initDatabase();
  
  console.log('🚀 Starting field migration...');
  const db = getDb();
  const store = new OpportunityStore();

  // 1. Get all opportunities that have the legacy fields
  try {
    const opps = db.prepare('SELECT id, next_step, notes FROM opportunities').all() as any[];
    console.log(`Found ${opps.length} opportunities to check.`);

    for (const opp of opps) {
      const { id, next_step, notes } = opp;

      // Migrate Next Steps -> Kanban (Follow-up column)
      if (next_step && next_step.trim()) {
        console.log(`  [${id}] Migrating Next Step: "${next_step.substring(0, 30)}..."`);
        await store.upsertStep(id, null, { text: next_step.trim(), column: 'followup' });
      }

      // Migrate Initial Notes -> Activities
      if (notes && notes.trim()) {
        console.log(`  [${id}] Migrating Initial Notes to Activity Log.`);
        await store.addActivity(id, {
          raw: notes.trim(),
          summary: 'Imported from legacy "Initial Notes" field.',
          ai: false
        });
      }
    }

    console.log('✅ Migration completed successfully.');
  } catch (err) {
    console.warn('⚠️ Migration query failed or columns missing. They may have already been removed.');
    console.error(err);
  }
}

migrate().catch(console.error);
