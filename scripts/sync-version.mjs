import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const versionFile = path.join(rootDir, 'VERSION');

async function syncVersion() {
  try {
    const version = (await fs.readFile(versionFile, 'utf8')).trim();
    console.log(`Syncing version: ${version}`);

    const packages = [
      path.join(rootDir, 'backend', 'package.json'),
      path.join(rootDir, 'frontend', 'package.json')
    ];

    const frontendVersionFile = path.join(rootDir, 'frontend', 'src', 'version.ts');

    for (const pkgPath of packages) {
      try {
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
        if (pkg.version !== version) {
          pkg.version = version;
          await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
          console.log(`Updated ${path.relative(rootDir, pkgPath)} to ${version}`);
        } else {
          console.log(`${path.relative(rootDir, pkgPath)} is already at ${version}`);
        }
      } catch (err) {
        console.error(`Error updating ${pkgPath}:`, err.message);
      }
    }

    try {
      const content = `export const APP_VERSION = '${version}';\n`;
      await fs.writeFile(frontendVersionFile, content);
      console.log(`Updated ${path.relative(rootDir, frontendVersionFile)} to ${version}`);
    } catch (err) {
      console.error(`Error updating ${frontendVersionFile}:`, err.message);
    }

    const envFile = path.join(rootDir, '.env');
    try {
      await fs.access(envFile);
      let envContent = await fs.readFile(envFile, 'utf8');
      if (envContent.includes('NEXREV_VERSION=')) {
        envContent = envContent.replace(/NEXREV_VERSION=.*/, `NEXREV_VERSION=${version}`);
      } else {
        envContent += `\n# Application Version\nNEXREV_VERSION=${version}\n`;
      }
      await fs.writeFile(envFile, envContent);
      console.log(`Updated .env to NEXREV_VERSION=${version}`);
    } catch {
      // .env doesn't exist, skip
    }
  } catch (err) {
    console.error(`Error reading version file:`, err.message);
    process.exit(1);
  }
}

syncVersion();
