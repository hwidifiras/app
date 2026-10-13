import path from 'node:path';
import { startLocalDatabase } from '../offline/runtime.mjs';
import { saveBackup } from '../offline/storage.mjs';
import { provisionLocalAccount } from '../offline/accounts.mjs';

const dataDir = process.env.GYM_DATA_DIR;
if (!dataDir) throw new Error('Set GYM_DATA_DIR and close All in Gym before provisioning.');
console.log('Waiting for local account credentials as JSON on standard input.');
let input = '';
for await (const chunk of process.stdin) input += chunk.toString();
const credentials = JSON.parse(input);
const database = await startLocalDatabase({ dataDir, binary: path.resolve('desktop/vendor/mongodb/bin/mongod.exe'), metadataPath: path.resolve('offline/model-metadata.json') });
try {
  await saveBackup(database.client, path.join(dataDir, 'backups', `before-account-${Date.now()}.gymbackup`), database.metadata, database.secrets.credentialSecret);
  await provisionLocalAccount(database, dataDir, credentials);
  console.log('Local administrator configured; new account creation disabled for this profile.');
} finally { await database.stop(); }
