import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeDocument } from '../offline/storage.mjs';
import { prepareClubImport } from '../offline/import.mjs';

const metadata = JSON.parse(await readFile(new URL('../offline/model-metadata.json', import.meta.url), 'utf8'));
function fixtures() {
  const current = Object.fromEntries(Object.keys(metadata.models).map((model) => [model, []]));
  current.Tenant.push(makeDocument(metadata, 'Tenant', { id: 'offline-club', slug: 'all-in-gym', name: 'Offline' }));
  current.User.push(makeDocument(metadata, 'User', { id: 'local-admin', tenantId: 'offline-club', email: 'local@example.test', name: 'Local', role: 'ADMIN', passwordHash: 'local-password-hash', isActive: true }));
  const source = { format: 'all-in-gym-club-export', version: 1, tenantId: 'source-club', collections: { User: [{ id: 'original-admin', tenantId: 'source-club', email: 'local@example.test', name: 'Original admin', role: 'ADMIN', passwordHash: 'original-password-hash', isActive: true }], ClubSettings: [{ id: 'original-settings', tenantId: 'source-club', clubName: 'Original club' }] } };
  return { source, current };
}
test('import keeps original user IDs and references while retaining the locked local password', () => {
  const { source, current } = fixtures();
  const result = prepareClubImport(source, metadata, current, { preserveLocalAccounts: true });
  assert.equal(result.collections.User.length, 1);
  assert.equal(result.collections.User[0]._id, 'original-admin');
  assert.equal(result.collections.User[0].passwordHash, 'local-password-hash');
  assert.equal(source.collections.User[0].passwordHash, 'original-password-hash');
  assert.equal(current.User[0]._id, 'local-admin');
});
test('an independently provisioned local administrator is preserved alongside imported accounts', () => {
  const { source, current } = fixtures();
  source.collections.User[0].email = 'original@example.test';
  const result = prepareClubImport(source, metadata, current, { preserveLocalAccounts: true });
  assert.equal(result.collections.User.length, 2);
  assert.ok(result.collections.User.some((row) => row._id === 'local-admin'));
});
test('foreign-tenant source rows are rejected before any database write', () => {
  const { source, current } = fixtures();
  source.collections.User[0].tenantId = 'another-club';
  assert.throws(() => prepareClubImport(source, metadata, current), /Invalid tenant records/);
});
test('broken original references are rejected before any database write', () => {
  const { source, current } = fixtures();
  source.collections.User[0].coachId = 'missing-coach';
  assert.throws(() => prepareClubImport(source, metadata, current), /Référence invalide/);
});
test('import preserves disabled modules rather than activating extra client features', () => {
  const { source, current } = fixtures();
  source.collections.TenantModule = [{ id: 'original-gym-module', tenantId: 'source-club', moduleKey: 'GYM_ACCESS', status: 'DISABLED', saasSubscriptionId: 'old-cloud-subscription' }];
  const result = prepareClubImport(source, metadata, current);
  const gym = result.collections.TenantModule.find((row) => row.moduleKey === 'GYM_ACCESS');
  assert.equal(gym.status, 'DISABLED');
  assert.equal(gym.saasSubscriptionId, null);
});
