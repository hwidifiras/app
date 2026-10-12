import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import path from 'node:path';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { startLocalDatabase } from '../offline/runtime.mjs';

// Run with the app closed, from this source checkout. Passwords are read from
// stdin, never supplied in a command line or bundled as shared defaults.
const dataDir = process.env.GYM_DATA_DIR;
if (!dataDir) throw new Error('Set GYM_DATA_DIR to the local All in Gym data directory.');
const readline = createInterface({ input: stdin, output: stdout });
const email = (await readline.question('Email du compte administrateur : ')).trim().toLowerCase();
const password = (await readline.question('Nouveau mot de passe (12 caractères minimum) : ')).trim();
readline.close();
if (password.length < 12) throw new Error('Mot de passe trop court.');
const database = await startLocalDatabase({ dataDir, binary: path.resolve('desktop/vendor/mongodb/bin/mongod.exe'), metadataPath: path.resolve('offline/model-metadata.json') });
try {
  const result = await database.client.db('all_in_gym').collection('User').updateOne({ tenantId: 'offline-club', email, role: 'ADMIN', isActive: true }, { $set: { passwordHash: await hash(password, 12), updatedAt: new Date() } });
  if (!result.matchedCount) throw new Error('Administrateur introuvable.');
  await database.client.db('all_in_gym').collection('AuditLog').insertOne({ _id: randomUUID(), tenantId: 'offline-club', action: 'OFFLINE_PASSWORD_RECOVERED', entityType: 'User', entityId: email, userId: null, details: null, createdAt: new Date() });
  console.log('Mot de passe réinitialisé.');
} finally { await database.stop(); }
