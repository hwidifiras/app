import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { startLocalDatabase } from '../offline/runtime.mjs';
import { saveBackup } from '../offline/storage.mjs';
import { prepareClubImport, applyClubImport } from '../offline/import.mjs';

// Import an explicitly supplied club export; this never connects to production.
const file = process.argv[2];
const dataDir = process.env.GYM_DATA_DIR;
if (!file || !dataDir) throw new Error('Usage: set GYM_DATA_DIR, then offline:import <club-export.json>. Close the app first.');
const source = JSON.parse(await readFile(file, 'utf8'));
if (source.format !== 'all-in-gym-club-export' || source.version !== 1 || !source.tenantId || !source.collections) throw new Error('Expected a version 1 All in Gym club export.');
const database = await startLocalDatabase({ dataDir, binary: path.resolve('desktop/vendor/mongodb/bin/mongod.exe'), metadataPath: path.resolve('offline/model-metadata.json') });
try {
  const db = database.client.db('all_in_gym');
  await saveBackup(database.client, path.join(dataDir, 'backups', `before-import-${Date.now()}.gymbackup`), database.metadata, database.secrets.credentialSecret);
  const collections = {};
  for (const name of Object.keys(database.metadata.models)) collections[name] = await db.collection(name).find({}).toArray();
  const prepared = prepareClubImport(source, database.metadata, collections, { preserveLocalAccounts: database.secrets.accountCreationDisabled === true });
  await applyClubImport(database, source, prepared);
  console.log('Import terminé. Original export and safety backup retained.');
} finally { await database.stop(); }
