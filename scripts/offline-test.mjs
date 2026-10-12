import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { startLocalDatabase } from '../offline/runtime.mjs';
import { downloadMongoDB, runtimeDir } from './download-mongodb.mjs';

await downloadMongoDB();
const parent = path.resolve('artifacts/disposable-tests');
await mkdir(parent, { recursive: true });
const dataDir = await mkdtemp(path.join(parent, 'run-'));
const database = await startLocalDatabase({ dataDir, binary: path.join(runtimeDir, 'bin/mongod.exe'), metadataPath: path.resolve('offline/model-metadata.json'), seed: false });
let exitCode = 1;
try {
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)], {
    stdio: 'inherit', windowsHide: true,
    env: { ...process.env, TEST_DATABASE_URL: database.uri, DATABASE_URL: database.uri, RATE_LIMIT_BACKEND: 'memory', OFFLINE_DESKTOP: '0', NEXT_TELEMETRY_DISABLED: '1' },
  });
  exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
} finally {
  await database.stop();
  if (!dataDir.startsWith(parent + path.sep)) throw new Error('Invalid disposable path');
  await rm(dataDir, { recursive: true, force: true });
}
process.exitCode = exitCode ?? 1;
