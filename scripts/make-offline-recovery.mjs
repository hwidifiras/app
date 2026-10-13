import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { loadMetadata, readBackup } from '../offline/storage.mjs';
import { encryptRecovery } from '../offline/recovery.mjs';

// Pass { backup, output, password } as JSON on stdin. Do not put passwords in command arguments.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const settings = JSON.parse(input);
const metadata = await loadMetadata(path.resolve('offline/model-metadata.json'));
await readBackup(path.resolve(settings.backup), metadata);
const encrypted = await encryptRecovery(await readFile(path.resolve(settings.backup), 'utf8'), settings.password, metadata);
const output = path.resolve(settings.output);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, encrypted, { flag: 'wx', mode: 0o600, flush: true });
console.log('Encrypted recovery archive created. Keep it out of source control.');
