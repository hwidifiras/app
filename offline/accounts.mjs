import { hash } from 'bcryptjs';
import { makeDocument } from './storage.mjs';
import { persistLocalSecrets } from './runtime.mjs';

// Administrative provisioning is performed with the application closed.
// Credentials belong to this local profile, never to the source repository.
export async function provisionLocalAccount(database, dataDir, { email, password, name }) {
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('Email ou mot de passe invalide (8 caractères minimum).');
  }
  const passwordHash = await hash(password, 12);
  const db = database.client.db('all_in_gym');
  const session = database.client.startSession();
  try {
    await session.withTransaction(async () => {
      const existing = await db.collection('User').findOne({ tenantId: 'offline-club', email }, { session });
      const user = existing ?? makeDocument(database.metadata, 'User', { tenantId: 'offline-club', email, name: name?.trim() || email.split('@')[0], passwordHash, role: 'ADMIN', isActive: true });
      if (existing) {
        await db.collection('User').updateOne({ _id: existing._id }, { $set: { passwordHash, role: 'ADMIN', isActive: true, updatedAt: new Date() } }, { session });
      } else {
        await db.collection('User').insertOne(user, { session });
      }
      await db.collection('AuditLog').insertOne(makeDocument(database.metadata, 'AuditLog', {
        tenantId: 'offline-club', action: 'OFFLINE_ACCOUNT_PROVISIONED', entityType: 'User', entityId: user._id, userId: user._id,
      }), { session });
    });
  } finally { await session.endSession(); }
  database.secrets.accountCreationDisabled = true;
  await persistLocalSecrets(dataDir, database.secrets);
}
