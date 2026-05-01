import { initDatabase, migrateLegacyData } from '../db.js';

await initDatabase();
const result = await migrateLegacyData({ onlyWhenEmpty: false });

console.log('Legacy migration complete.');
console.log(`- Opportunities imported: ${result.opportunitiesImported}`);
console.log(`- Users imported: ${result.usersImported}`);
