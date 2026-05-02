import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const versionFile = path.join(rootDir, 'VERSION');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function release() {
  try {
    const currentVersion = (await fs.readFile(versionFile, 'utf8')).trim();
    console.log(`Current Version: ${currentVersion}`);

    const newVersion = await question(`Enter new version (YYYY.M.PATCH) or press enter to keep [${currentVersion}]: `);
    const versionToUse = newVersion.trim() || currentVersion;

    // Write to VERSION
    await fs.writeFile(versionFile, versionToUse + '\n');
    console.log(`Updated VERSION to ${versionToUse}`);

    // Run sync-version
    console.log('Synchronizing package configurations...');
    execSync(`node ${path.join(rootDir, 'scripts', 'sync-version.mjs')}`, { stdio: 'inherit' });

    const createTag = await question('Create git tag locally? (y/n): ');
    if (createTag.toLowerCase() === 'y') {
      try {
        const tagName = `v${versionToUse}`;
        execSync(`git tag -a ${tagName} -m "Release ${tagName}"`);
        console.log(`Created tag: ${tagName}`);
        console.log(`\nNext steps:\n  git push origin main --tags`);
      } catch (err) {
        console.error('Error creating git tag. Ensure you are in a git repository and the tag does not already exist.');
      }
    }

  } catch (err) {
    console.error('Release failed:', err.message);
  } finally {
    rl.close();
  }
}

release();
