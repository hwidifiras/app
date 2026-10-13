import { readFile, writeFile, rename, mkdir, readdir, lstat } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { BSON } from 'mongodb';

export async function loadMetadata(file) { return JSON.parse(await readFile(file, 'utf8')); }

export function makeDocument(metadata, model, values) {
  const document = {};
  for (const field of metadata.models[model].fields) {
    if (field.relation) continue;
    let value = values[field.name];
    if (value === undefined) {
      if (field.default === 'now' || field.updatedAt) value = new Date();
      else if (field.default === 'cuid') value = randomUUID();
      else if (field.default !== undefined) value = field.default;
      else if (field.optional) value = null;
      else if (field.list) value = [];
      else throw new Error(`Missing ${model}.${field.name}`);
    }
    if (value !== null && field.type === 'DateTime' && !(value instanceof Date)) value = new Date(value);
    document[field.name === 'id' ? '_id' : field.name] = value;
  }
  return document;
}

export async function initializeCollections(db, metadata) {
  for (const [name, model] of Object.entries(metadata.models)) {
    try { await db.createCollection(name); } catch (error) { if (error.code !== 48) throw error; }
    for (const index of model.indexes) {
      const key = Object.fromEntries(index.fields.map((field) => [field === 'id' ? '_id' : field, 1]));
      const optional = index.fields.filter((field) => model.fields.find((f) => f.name === field)?.optional);
      const options = { name: `${name}_${index.fields.join('_')}_${index.unique ? 'key' : 'idx'}`, ...(index.unique ? { unique: true } : {}) };
      // PostgreSQL allowed multiple NULL values. Preserve that behavior for
      // optional phones, predecessor links and coach accounts using partial indexes.
      if (index.unique && optional.length) options.partialFilterExpression = Object.fromEntries(optional.map((field) => [field, { $type: 'string' }]));
      await db.collection(name).createIndex(key, options);
    }
  }
  await db.collection('TenantSaasSubscription').createIndex({ tenantId: 1 }, { name: 'one_current_subscription_per_tenant', unique: true, partialFilterExpression: { isCurrent: true } });
}

export async function saveBackup(client, file, metadata, credentialSecret, profile = {}) {
  const session = client.startSession();
  const collections = {};
  try {
    await session.withTransaction(async () => {
      for (const name of Object.keys(metadata.models)) collections[name] = await client.db('all_in_gym').collection(name).find({}, { session }).toArray();
    }, { readConcern: { level: 'snapshot' } });
  } finally { await session.endSession(); }
  const credentials = credentialSecret ? { accessCredentialSecret: credentialSecret } : undefined;
  const branding = {};
  if (profile.dataDir) {
    const directory = path.join(profile.dataDir, 'branding');
    for (const name of await readdir(directory).catch((error) => { if (error.code === 'ENOENT') return []; throw error; })) {
      if (!/^club-logo(?:-[a-z0-9-]+)?\.(png|jpg|jpeg|webp)$/.test(name)) continue;
      const info = await lstat(path.join(directory, name));
      if (!info.isFile() || info.isSymbolicLink() || info.size > 5 * 1024 * 1024) throw new Error('Logo local invalide.');
      branding[name] = (await readFile(path.join(directory, name))).toString('base64');
    }
  }
  const content = BSON.EJSON.stringify({ format: 'all-in-gym-nosql', version: 2, createdAt: new Date(), collections, credentials, branding, accountCreationDisabled: profile.accountCreationDisabled === true }, { relaxed: false });
  const envelope = JSON.stringify({ sha256: createHash('sha256').update(content).digest('hex'), content });
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, envelope, { mode: 0o600 });
  await rename(temporary, file);
  return file;
}

export async function readBackup(file, metadata) {
  const info = await lstat(file);
  if (!info.isFile() || info.size > 100 * 1024 * 1024) throw new Error('Sauvegarde trop volumineuse.');
  return decodeBackup(await readFile(file, 'utf8'), metadata);
}

export function decodeBackup(content, metadata) {
  const envelope = JSON.parse(content);
  if (typeof envelope.content !== 'string' || createHash('sha256').update(envelope.content).digest('hex') !== envelope.sha256) throw new Error('Sauvegarde endommagée.');
  const data = BSON.EJSON.parse(envelope.content, { relaxed: true });
  if (data.format !== 'all-in-gym-nosql' || ![1, 2].includes(data.version)) throw new Error('Format de sauvegarde incompatible.');
  if (data.credentials && (typeof data.credentials.accessCredentialSecret !== 'string' || data.credentials.accessCredentialSecret.length < 16)) throw new Error('Clé de carte invalide.');
  validateSnapshot(data, metadata);
  for (const [name, encoded] of Object.entries(data.branding ?? {})) {
    if (!/^club-logo(?:-[a-z0-9-]+)?\.(png|jpg|jpeg|webp)$/.test(name) || typeof encoded !== 'string' || encoded.length > 7 * 1024 * 1024 || Buffer.from(encoded, 'base64').toString('base64') !== encoded) throw new Error('Logo de sauvegarde invalide.');
  }
  if (data.accountCreationDisabled !== undefined && typeof data.accountCreationDisabled !== 'boolean') throw new Error('Politique de comptes invalide.');
  return data;
}

export function validateSnapshot(data, metadata) {
  if (!data || typeof data.collections !== 'object' || data.collections === null || Object.keys(data.collections).some((name) => !Object.hasOwn(metadata.models, name))) throw new Error('Collections de sauvegarde invalides.');
  for (const name of Object.keys(metadata.models)) {
    if (!Array.isArray(data.collections[name])) throw new Error(`Collection manquante : ${name}`);
    for (const row of data.collections[name]) if (typeof row._id !== 'string') throw new Error(`Identifiant invalide : ${name}`);
    if (new Set(data.collections[name].map((row) => row._id)).size !== data.collections[name].length) throw new Error(`Identifiant répété : ${name}`);
  }
  const identities = Object.fromEntries(Object.entries(data.collections).map(([name, rows]) => [name, new Map(rows.map((row) => [row._id, row]))]));
  for (const [name, model] of Object.entries(metadata.models)) for (const row of data.collections[name]) {
    for (const field of model.fields) {
      if (field.relation) continue;
      const value = row[field.name === 'id' ? '_id' : field.name];
      if (value === undefined || (value === null && !field.optional)) throw new Error(`Champ manquant : ${name}.${field.name}`);
      if (field.type === 'DateTime' && value !== null && (!(value instanceof Date) || !Number.isFinite(value.getTime()))) throw new Error(`Date invalide : ${name}.${field.name}`);
      if (value !== null && !field.list && field.type === 'String' && typeof value !== 'string') throw new Error(`Texte invalide : ${name}.${field.name}`);
      if (value !== null && !field.list && field.type === 'Int' && (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)) throw new Error(`Entier invalide : ${name}.${field.name}`);
      if (value !== null && !field.list && field.type === 'Boolean' && typeof value !== 'boolean') throw new Error(`Booléen invalide : ${name}.${field.name}`);
      if (field.list && !Array.isArray(value)) throw new Error(`Liste invalide : ${name}.${field.name}`);
    }
    for (const reference of model.references) {
      if (reference.fields.some((field) => row[field] === null || row[field] === undefined)) continue;
      const target = reference.references.length === 1 && reference.references[0] === 'id'
        ? identities[reference.model]?.get(row[reference.fields[0]])
        : data.collections[reference.model]?.find((candidate) => reference.fields.every((field, i) => candidate[reference.references[i]] === row[field]));
      if (!target || (row.tenantId && target.tenantId && row.tenantId !== target.tenantId)) throw new Error(`Référence invalide : ${name}`);
    }
  }
}

export async function restoreBackup(client, file, metadata) {
  const data = await readBackup(file, metadata);
  return restoreSnapshot(client, data, metadata);
}

export async function restoreSnapshot(client, data, metadata) {
  validateSnapshot(data, metadata);
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      for (const name of Object.keys(metadata.models)) {
        const collection = client.db('all_in_gym').collection(name);
        await collection.deleteMany({}, { session });
        if (data.collections[name].length) await collection.insertMany(data.collections[name], { session });
      }
    });
  } finally { await session.endSession(); }
  return data;
}
