import { makeDocument, validateSnapshot } from './storage.mjs';

export function prepareClubImport(source, metadata, current, { preserveLocalAccounts = false } = {}) {
  if (source.format !== 'all-in-gym-club-export' || source.version !== 1 || !source.tenantId || !source.collections) throw new Error('Expected a version 1 All in Gym club export.');
  const collections = { ...current };
  const selected = [];
  for (const [name, model] of Object.entries(metadata.models)) {
    if (!model.fields.some((field) => field.name === 'tenantId') || name.startsWith('Workspace') || ['TenantSaasSubscription', 'TenantOnboarding'].includes(name)) continue;
    const rows = source.collections[name] ?? [];
    if (!Array.isArray(rows) || rows.some((row) => row.tenantId !== source.tenantId)) throw new Error(`Invalid tenant records: ${name}`);
    collections[name] = rows.map((row) => makeDocument(metadata, name, {
      ...row, tenantId: 'offline-club',
      ...(name === 'ClubSettings' ? { registrationOnly: false, receiptEmailDefault: false } : {}),
      ...(name === 'TenantModule' ? { grantSource: 'MANUAL', saasSubscriptionId: null } : {}),
    }));
    selected.push(name);
  }
  if (preserveLocalAccounts) {
    for (const local of current.User.filter((row) => row.role === 'ADMIN' && row.isActive)) {
      const imported = collections.User.find((row) => row.email.toLowerCase() === local.email.toLowerCase());
      if (imported) {
        // Keep the original user ID so financial/audit references stay intact,
        // while retaining the independently configured offline login.
        imported.passwordHash = local.passwordHash;
        imported.role = 'ADMIN';
        imported.isActive = true;
      } else {
        collections.User.push({ ...local });
      }
    }
  }
  if (collections.ClubSettings.length !== 1 || !collections.User.some((row) => row.role === 'ADMIN' && row.isActive)) throw new Error('Export must include club settings and an active administrator.');
  for (const moduleKey of ['CLASS_MANAGEMENT', 'GYM_ACCESS']) if (!collections.TenantModule.some((row) => row.moduleKey === moduleKey)) collections.TenantModule.push(makeDocument(metadata, 'TenantModule', { tenantId: 'offline-club', moduleKey, status: 'ENABLED', enabledAt: new Date() }));
  validateSnapshot({ collections }, metadata);
  return { collections, selected };
}

export async function applyClubImport(database, source, prepared) {
  const db = database.client.db('all_in_gym');
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const name of prepared.selected) {
        await db.collection(name).deleteMany({ tenantId: 'offline-club' }, { session });
        if (prepared.collections[name].length) await db.collection(name).insertMany(prepared.collections[name], { session });
      }
      await db.collection('Tenant').updateOne({ _id: 'offline-club' }, { $set: { name: source.tenant?.name || prepared.collections.ClubSettings[0].clubName, updatedAt: new Date() } }, { session });
      await db.collection('AuditLog').insertOne(makeDocument(database.metadata, 'AuditLog', { tenantId: 'offline-club', action: 'OFFLINE_CLUB_IMPORTED', entityType: 'Tenant', entityId: 'offline-club', details: JSON.stringify({ sourceTenantId: source.tenantId, exportId: source.exportId ?? null }) }), { session });
    });
  } finally { await session.endSession(); }
}
