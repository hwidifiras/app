import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { startLocalDatabase } from '../offline/runtime.mjs';
import { makeDocument, saveBackup, validateSnapshot } from '../offline/storage.mjs';

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
  const selected = [];
  for (const [name, model] of Object.entries(database.metadata.models)) {
    if (!model.fields.some((f) => f.name === 'tenantId') || name.startsWith('Workspace') || ['TenantSaasSubscription', 'TenantOnboarding'].includes(name)) continue;
    const rows = source.collections[name] ?? [];
    if (!Array.isArray(rows) || rows.some((row) => row.tenantId !== source.tenantId)) throw new Error(`Invalid tenant records: ${name}`);
    collections[name] = rows.map((row) => makeDocument(database.metadata, name, {
      ...row, tenantId: 'offline-club',
      ...(name === 'ClubSettings' ? { registrationOnly: false, receiptEmailDefault: false } : {}),
      ...(name === 'TenantModule' ? { grantSource: 'MANUAL', saasSubscriptionId: null, status: 'ENABLED' } : {}),
    }));
    selected.push(name);
  }
  if (collections.ClubSettings.length !== 1 || !collections.User.some((row) => row.role === 'ADMIN' && row.isActive)) throw new Error('Export must include club settings and an active administrator.');
  for (const moduleKey of ['CLASS_MANAGEMENT', 'GYM_ACCESS']) if (!collections.TenantModule.some((row) => row.moduleKey === moduleKey)) collections.TenantModule.push(makeDocument(database.metadata, 'TenantModule', { tenantId: 'offline-club', moduleKey, status: 'ENABLED', enabledAt: new Date() }));
  validateSnapshot({ collections }, database.metadata);
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const name of selected) {
        await db.collection(name).deleteMany({ tenantId: 'offline-club' }, { session });
        if (collections[name].length) await db.collection(name).insertMany(collections[name], { session });
      }
      await db.collection('AuditLog').insertOne(makeDocument(database.metadata, 'AuditLog', { tenantId: 'offline-club', action: 'OFFLINE_CLUB_IMPORTED', entityType: 'Tenant', entityId: 'offline-club', details: JSON.stringify({ sourceTenantId: source.tenantId, exportId: source.exportId ?? null }) }), { session });
    });
  } finally { await session.endSession(); }
  console.log('Import terminé. Original export and safety backup retained.');
} finally { await database.stop(); }
