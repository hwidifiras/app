import { randomBytes, scrypt, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { writeFile, mkdir, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { BSON } from 'mongodb';
import { decodeBackup, saveBackup, readBackup, restoreSnapshot } from './storage.mjs';
import { persistLocalSecrets } from './runtime.mjs';

const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function encryptRecovery(backup, password, metadata) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) throw new Error('Mot de passe de récupération invalide.');
  const data = decodeBackup(backup, metadata);
  if (!data.accountCreationDisabled || !data.collections.User.some((user) => user.role === 'ADMIN' && user.isActive)) throw new Error('La récupération doit contenir un administrateur et verrouiller la création de comptes.');
  const salt = randomBytes(32), iv = randomBytes(12);
  const key = await derive(password, salt, 32, options);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const header = { format: 'we-discipline-recovery', version: 1, createdAt: data.createdAt.toISOString(), memberCount: data.collections.Member.length, kdf: 'scrypt-32768-8-1' };
    const aad = Buffer.from(JSON.stringify(header));
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(backup, 'utf8'), cipher.final()]);
    return JSON.stringify({ header, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), encrypted: encrypted.toString('base64') });
  } finally { key.fill(0); }
}
export async function decryptRecovery(content, password, metadata) {
  if (typeof content !== 'string' || content.length > 140 * 1024 * 1024 || typeof password !== 'string' || password.length > 256) throw new Error('Archive de récupération invalide.');
  const archive = JSON.parse(content);
  if (archive.header?.format !== 'we-discipline-recovery' || archive.header.version !== 1 || archive.header.kdf !== 'scrypt-32768-8-1') throw new Error('Archive de récupération incompatible.');
  const salt = Buffer.from(archive.salt ?? '', 'base64'), iv = Buffer.from(archive.iv ?? '', 'base64'), tag = Buffer.from(archive.tag ?? '', 'base64');
  if (salt.length !== 32 || iv.length !== 12 || tag.length !== 16) throw new Error('Archive de récupération invalide.');
  const key = await derive(password, salt, 32, options);
  let backup;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(JSON.stringify(archive.header))); decipher.setAuthTag(tag);
    backup = Buffer.concat([decipher.update(Buffer.from(archive.encrypted, 'base64')), decipher.final()]);
  } catch { throw new Error('Mot de passe incorrect ou archive endommagée.'); }
  finally { key.fill(0); }
  try { return decodeBackup(backup.toString('utf8'), metadata); }
  finally { backup.fill(0); }
}

async function applyBranding(dataDir, data) {
  // Old version 1 archives did not contain logos: preserve the current files.
  if (data.version === 1) return;
  const directory = path.join(dataDir, 'branding');
  await mkdir(directory, { recursive: true });
  for (const [name, value] of Object.entries(data.branding ?? {})) {
    if (!/^club-logo(?:-[a-z0-9-]+)?\.(png|jpg|jpeg|webp)$/.test(name)) throw new Error('Logo invalide.');
    const target = path.join(directory, name), temporary = `${target}.restore.tmp`;
    await writeFile(temporary, Buffer.from(value, 'base64'), { mode: 0o600, flush: true });
    await rename(temporary, target);
  }
  for (const name of await readdir(directory)) if (/^club-logo(?:-[a-z0-9-]+)?\.(png|jpg|jpeg|webp)$/.test(name) && !Object.hasOwn(data.branding ?? {}, name)) await unlink(path.join(directory, name));
}

export async function recoverProfile(database, dataDir, data, { afterRestore } = {}) {
  // The caller stops the web server before entering this function.
  const content = BSON.EJSON.stringify(data, { relaxed: false });
  decodeBackup(JSON.stringify({ content, sha256: createHash('sha256').update(content).digest('hex') }), database.metadata);
  if (data.collections.Tenant.length !== 1 || data.collections.Tenant[0]._id !== 'offline-club' || data.collections.User.some((user) => user.tenantId !== 'offline-club') || !data.collections.User.some((user) => user.role === 'ADMIN' && user.isActive)) throw new Error('Sauvegarde de club local incompatible.');
  const safetyFile = path.join(dataDir, 'backups', `before-restore-${Date.now()}-${randomBytes(4).toString('hex')}.gymbackup`);
  await saveBackup(database.client, safetyFile, database.metadata, database.secrets.credentialSecret, { dataDir, accountCreationDisabled: database.secrets.accountCreationDisabled });
  const previous = await readBackup(safetyFile, database.metadata);
  const oldSecrets = { ...database.secrets };
  // Keep the local login while retaining source IDs used by the restored records.
  if (oldSecrets.accountCreationDisabled) {
    for (const local of previous.collections.User.filter((user) => user.role === 'ADMIN' && user.isActive)) {
      const target = data.collections.User.find((user) => user.email.toLowerCase() === local.email.toLowerCase());
      if (!target) throw new Error('Cette sauvegarde ne contient pas votre administrateur local. Restauration refusée.');
      target.passwordHash = local.passwordHash; target.isActive = true; target.role = 'ADMIN';
    }
  }
  try {
    await restoreSnapshot(database.client, data, database.metadata);
    await applyBranding(dataDir, data);
    database.secrets.credentialSecret = data.credentials?.accessCredentialSecret ?? oldSecrets.credentialSecret;
    database.secrets.accountCreationDisabled = oldSecrets.accountCreationDisabled === true || data.accountCreationDisabled === true;
    await persistLocalSecrets(dataDir, database.secrets);
    await afterRestore?.();
    return safetyFile;
  } catch (error) {
    try {
      await restoreSnapshot(database.client, previous, database.metadata);
      await applyBranding(dataDir, previous);
      Object.assign(database.secrets, oldSecrets);
      await persistLocalSecrets(dataDir, oldSecrets);
      await afterRestore?.();
    } catch (rollbackError) { throw new Error(`Restauration interrompue. Conservez la sauvegarde de sécurité ${safetyFile}. ${rollbackError.message}`, { cause: error }); }
    throw error;
  }
}
