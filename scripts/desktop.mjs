import { spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { downloadMongoDB } from './download-mongodb.mjs';
import { stageServerDependencies } from './stage-server-dependencies.mjs';

function run(executable, args, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, stdio: 'inherit', windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_OFFLINE: '1', NEXT_PUBLIC_APP_NAME: 'All in Gym', OFFLINE_DESKTOP: '1', DATABASE_URL: 'mongodb://127.0.0.1:27017/all_in_gym?replicaSet=allInGymLocal' } });
    child.on('error', reject); child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${executable} exited ${code}`)));
  });
}
await downloadMongoDB();
await run(process.execPath, ['node_modules/prisma/build/index.js', 'generate']);
await run(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack']);
const target = path.resolve('desktop/web');
if (!target.startsWith(path.resolve('desktop') + path.sep)) throw new Error('Invalid web staging path');
await rm(target, { force: true, recursive: true });
await mkdir(target, { recursive: true });
await cp('.next/standalone', target, { recursive: true, dereference: true });
await stageServerDependencies(target);
await cp('public', path.join(target, 'public'), { recursive: true });
await cp('.next/static', path.join(target, '.next/static'), { recursive: true });
await cp('offline', 'desktop/offline', { recursive: true });
const mode = process.argv[2] ?? 'dev';
if (mode === 'dev') await run(process.execPath, ['node_modules/electron/cli.js', '.'], path.resolve('desktop'));
else await run(process.execPath, ['node_modules/electron-builder/cli.js', '--win', ...(mode === 'package' ? ['--dir'] : ['nsis']), '--x64'], path.resolve('desktop'));
