import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const versionFile = path.join(rootDir, 'VERSION');

const helpText = `
Usage: node scripts/release.mjs [type|version]

Options:
  patch          Increment patch version (default, e.g., 2026.5.4 -> 2026.5.5)
  minor          Increment month version (e.g., 2026.5.4 -> 2026.6.0)
  major          Increment year version (e.g., 2026.5.4 -> 2027.1.0)
  [version]      Manually specify a version (e.g., 2026.10.0)
  --help, -h     Show this help message

Examples:
  node scripts/release.mjs
  node scripts/release.mjs minor
  node scripts/release.mjs 2026.12.0
`;

function parseVersion(v) {
  const parts = v.trim().split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${v}. Expected YYYY.M.PATCH`);
  }
  return parts;
}

function incrementVersion(current, type) {
  let [y, m, p] = parseVersion(current);

  switch (type) {
    case 'patch':
      p++;
      break;
    case 'minor':
      m++;
      p = 0;
      if (m > 12) {
        y++;
        m = 1;
      }
      break;
    case 'major':
      y++;
      m = 1;
      p = 0;
      break;
    default:
      // If it looks like a version, use it directly
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        return type;
      }
      throw new Error(`Unknown increment type: ${type}`);
  }

  return `${y}.${m}.${p}`;
}

async function release() {
  const args = process.argv.slice(2);
  const arg = args[0] || 'patch';

  if (arg === '--help' || arg === '-h') {
    console.log(helpText);
    return;
  }

  try {
    const currentVersion = (await fs.readFile(versionFile, 'utf8')).trim();
    console.log(`Current Version: ${currentVersion}`);

    let newVersion;
    if (/^\d+\.\d+\.\d+$/.test(arg)) {
      newVersion = arg;
    } else {
      newVersion = incrementVersion(currentVersion, arg);
    }

    console.log(`Target Version:  ${newVersion}`);

    // Write to VERSION
    await fs.writeFile(versionFile, newVersion + '\n');
    console.log(`\n✅ Updated VERSION to ${newVersion}`);

    // Run sync-version
    console.log('🔄 Synchronizing package configurations...');
    try {
      execSync(`node ${path.join(__dirname, 'sync-version.mjs')}`, { stdio: 'inherit' });
    } catch (err) {
      console.error('❌ Synchronization failed. Please check sync-version.mjs.');
      process.exit(1);
    }

    const tagName = `v${newVersion}`;
    console.log(`\n🚀 Release ${newVersion} prepared!`);
    console.log(`\nRun the following commands to finalize the release:\n`);
    console.log(`  git add .`);
    console.log(`  git commit -m "Release ${tagName}"`);
    console.log(`  git tag -a ${tagName} -m "Release ${tagName}"`);
    console.log(`  git push origin main --tags`);
    console.log(``);

  } catch (err) {
    console.error(`\n❌ Release failed: ${err.message}`);
    console.log(helpText);
    process.exit(1);
  }
}

release();
