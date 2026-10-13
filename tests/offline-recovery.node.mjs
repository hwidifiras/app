import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { startLocalDatabase } from '../offline/runtime.mjs';
import { provisionLocalAccount } from '../offline/accounts.mjs';
import { saveBackup, readBackup, makeDocument } from '../offline/storage.mjs';
import { encryptRecovery, decryptRecovery, recoverProfile } from '../offline/recovery.mjs';

test('encrypted recovery rejects tampering, restores logo/card key/account policy and rolls back late failures', async () => {
  const parent = path.resolve('artifacts/recovery-tests');
  await mkdir(parent, { recursive: true });
  const dataDir = await mkdtemp(path.join(parent, 'profile-'));
  const database = await startLocalDatabase({ dataDir, binary: path.resolve('desktop/vendor/mongodb/bin/mongod.exe'), metadataPath: path.resolve('offline/model-metadata.json') });
  const db = database.client.db('all_in_gym');
  try {
    await provisionLocalAccount(database, dataDir, { email: 'recovery-admin@example.test', password: 'Recovery-test-password', name: 'Recovery Admin' });
    await mkdir(path.join(dataDir, 'branding'), { recursive: true });
    await writeFile(path.join(dataDir, 'branding/club-logo.png'), Buffer.from('original-logo-bytes'));
    await db.collection('Member').insertOne(makeDocument(database.metadata, 'Member', { id: 'original-student', tenantId: 'offline-club', firstName: 'Original', lastName: 'Student', phone: '00112233' }));
    const backup = path.join(dataDir, 'original.gymbackup');
    await saveBackup(database.client, backup, database.metadata, database.secrets.credentialSecret, { dataDir, accountCreationDisabled: true });
    const archive = await encryptRecovery(await readFile(backup, 'utf8'), 'Archive-passphrase', database.metadata);
    assert.equal(archive.includes('original-student'), false);
    assert.equal(archive.includes('Archive-passphrase'), false);
    await assert.rejects(decryptRecovery(archive, 'wrong-password', database.metadata), /incorrect/);
    const damaged = JSON.parse(archive); damaged.header.memberCount++;
    await assert.rejects(decryptRecovery(JSON.stringify(damaged), 'Archive-passphrase', database.metadata), /endommagée/);
    const restored = await decryptRecovery(archive, 'Archive-passphrase', database.metadata);
    const originalKey = database.secrets.credentialSecret;
    await db.collection('Member').updateOne({ _id: 'original-student' }, { $set: { firstName: 'Current' } });
    await writeFile(path.join(dataDir, 'branding/club-logo.png'), Buffer.from('current-logo-bytes'));
    let calls = 0;
    await assert.rejects(recoverProfile(database, dataDir, restored, { afterRestore: async () => { if (++calls === 1) throw new Error('simulated disk failure'); } }), /disk failure/);
    assert.equal((await db.collection('Member').findOne({ _id: 'original-student' })).firstName, 'Current');
    assert.equal(await readFile(path.join(dataDir, 'branding/club-logo.png'), 'utf8'), 'current-logo-bytes');
    const safety = await recoverProfile(database, dataDir, restored);
    assert.equal((await db.collection('Member').findOne({ _id: 'original-student' })).firstName, 'Original');
    assert.equal(await readFile(path.join(dataDir, 'branding/club-logo.png'), 'utf8'), 'original-logo-bytes');
    assert.equal(database.secrets.credentialSecret, originalKey);
    assert.equal(database.secrets.accountCreationDisabled, true);
    assert.equal((await readBackup(safety, database.metadata)).collections.Member[0].firstName, 'Current');
    assert.equal(JSON.parse(await readFile(path.join(dataDir, 'local-secrets.json'), 'utf8')).accountCreationDisabled, true);
  } finally {
    await database.stop();
    if (!dataDir.startsWith(parent + path.sep)) throw new Error('Invalid disposable profile');
    await rm(dataDir, { recursive: true, force: true });
  }
});
