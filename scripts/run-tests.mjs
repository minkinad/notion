import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const testsRoot = path.resolve('.test-dist/tests');

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectTestFiles(fullPath);
      }

      return fullPath.endsWith('.test.js') ? [fullPath] : [];
    }),
  );

  return files.flat().sort();
}

async function main() {
  const testFiles = await collectTestFiles(testsRoot);
  if (testFiles.length === 0) {
    throw new Error(`No compiled tests found in ${testsRoot}`);
  }

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', ...testFiles], {
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Tests failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
