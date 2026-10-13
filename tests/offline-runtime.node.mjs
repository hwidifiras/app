import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startLocalDatabase } from '../offline/runtime.mjs';
import { makeDocument, saveBackup, restoreBackup } from '../offline/storage.mjs';

test('embedded NoSQL persists across restart, rolls back failed transactions and restores validated backups', async () => {
  const parent = path.resolve('artifacts/runtime-tests');
  await mkdir(parent, { recursive: true });
  const dataDir = await mkdtemp(path.join(parent, 'run-'));
  const options = { dataDir, binary: path.resolve('desktop/vendor/mongodb/bin/mongod.exe'), metadataPath: path.resolve('offline/model-metadata.json') };
  let database = await startLocalDatabase(options);
  try {
    const member = makeDocument(database.metadata, 'Member', { id: 'persisted-member', tenantId: 'offline-club', firstName: 'Offline', lastName: 'Member', phone: null });
    await database.client.db('all_in_gym').collection('Member').insertOne(member);
    const session = database.client.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        await database.client.db('all_in_gym').collection('Member').updateOne({ _id: member._id }, { $set: { firstName: 'Rolled back' } }, { session });
        throw new Error('rollback');
      }), /rollback/);
    } finally { await session.endSession(); }
    const backup = path.join(dataDir, 'snapshot.gymbackup');
    await saveBackup(database.client, backup, database.metadata, database.secrets.credentialSecret);
    await database.client.db('all_in_gym').collection('Member').deleteOne({ _id: member._id });
    const restored = await restoreBackup(database.client, backup, database.metadata);
    assert.equal(restored.credentials.accessCredentialSecret, database.secrets.credentialSecret);
    assert.equal((await database.client.db('all_in_gym').collection('Member').findOne({ _id: member._id })).firstName, 'Offline');
    const corrupt = JSON.parse(await readFile(backup, 'utf8'));
    corrupt.content += 'corruption';
    await writeFile(path.join(dataDir, 'corrupt.gymbackup'), JSON.stringify(corrupt));
    await assert.rejects(restoreBackup(database.client, path.join(dataDir, 'corrupt.gymbackup'), database.metadata), /endommagée/);
    await database.stop();
    database = await startLocalDatabase(options);
    assert.equal(await database.client.db('all_in_gym').collection('Member').countDocuments({ _id: member._id }), 1);
    assert.equal(await database.client.db('all_in_gym').collection('Tenant').countDocuments(), 1);
    // Multiple children can have no personal phone; populated phones remain unique.
    await database.client.db('all_in_gym').collection('Member').insertOne(makeDocument(database.metadata, 'Member', { id: 'child-two', tenantId: 'offline-club', firstName: 'Second', lastName: 'Child', phone: null }));
    assert.equal(await database.client.db('all_in_gym').collection('Member').countDocuments(), 2);
  } finally {
    await database.stop();
    if (!dataDir.startsWith(parent + path.sep)) throw new Error('Invalid disposable path');
    await rm(dataDir, { recursive: true, force: true });
  }
});
