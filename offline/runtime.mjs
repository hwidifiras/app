import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile, chmod, rename, access } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { loadMetadata, initializeCollections, makeDocument } from './storage.mjs';

export async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function loadLocalSecrets(dataDir) {
  await mkdir(dataDir, { recursive: true });
  const target = path.join(dataDir, 'local-secrets.json');
  try {
    const value = JSON.parse(await readFile(target, 'utf8'));
    if (!value.applicationPort) { value.applicationPort = await availablePort(); await writeFile(target, JSON.stringify(value), { mode: 0o600 }); }
    return value;
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const secret = () => randomBytes(48).toString('base64url');
    const value = { databasePassword: secret(), authSecret: secret(), credentialSecret: secret(), replicaKey: randomBytes(512).toString('base64'), databasePort: await availablePort(), applicationPort: await availablePort() };
    await writeFile(target, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
    return value;
  }
}

export async function persistLocalSecrets(dataDir, secrets) {
  const target = path.join(dataDir, 'local-secrets.json');
  const temporary = `${target}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary, JSON.stringify(secrets), { mode: 0o600, flush: true });
  await rename(temporary, target);
}

async function waitForDatabase(uri, child, primary = false, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local database exited (${child.exitCode}). See database.log.`);
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 1000, connectTimeoutMS: 1000 });
    try {
      await client.connect();
      const hello = await client.db('admin').command({ hello: 1 });
      if (!primary || hello.isWritablePrimary) return client;
    } catch (error) { lastError = error; }
    await client.close();
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Local database startup timed out: ${lastError?.message ?? 'replica not ready'}`);
}

export async function startLocalDatabase({ dataDir, binary, metadataPath, seed = true }) {
  const secrets = await loadLocalSecrets(dataDir);
  const port = secrets.databasePort;
  const dbPath = path.join(dataDir, 'database');
  const existingDatabase = await access(path.join(dbPath, 'WiredTiger')).then(() => true, (error) => { if (error.code === 'ENOENT') return false; throw error; });
  const keyPath = path.join(dataDir, 'replica.key');
  await mkdir(dbPath, { recursive: true });
  await writeFile(keyPath, secrets.replicaKey, { mode: 0o600 });
  if (process.platform !== 'win32') await chmod(keyPath, 0o600);
  const child = spawn(binary, ['--dbpath', dbPath, '--bind_ip', '127.0.0.1', '--port', String(port), '--replSet', 'allInGymLocal', '--keyFile', keyPath, '--auth', '--logpath', path.join(dataDir, 'database.log'), '--logappend', '--wiredTigerCacheSizeGB', '0.25'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let spawnError;
  child.once('error', (error) => { spawnError = error; });
  child.stderr.on('data', () => {});
  const bareUri = `mongodb://127.0.0.1:${port}/admin?directConnection=true`;
  const uri = `mongodb://allInGym:${encodeURIComponent(secrets.databasePassword)}@127.0.0.1:${port}/all_in_gym?authSource=admin&replicaSet=allInGymLocal&directConnection=true`;
  let client;
  try {
    if (existingDatabase) {
      // An existing replica can take longer to elect its primary under load.
      // Never mistake this for first setup and issue unauthenticated bootstrap commands.
      client = await waitForDatabase(uri, child, true);
    } else {
      if (spawnError) throw spawnError;
      // The localhost exception only permits initial replica/user creation.
      const bootstrap = await waitForDatabase(bareUri, child);
      try { await bootstrap.db('admin').command({ replSetInitiate: { _id: 'allInGymLocal', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } }); }
      catch (initError) { if (initError.code !== 23) throw initError; }
      await bootstrap.close();
      const primary = await waitForDatabase(bareUri, child, true);
      try { await primary.db('admin').command({ createUser: 'allInGym', pwd: secrets.databasePassword, roles: [{ role: 'root', db: 'admin' }] }); }
      finally { await primary.close(); }
      client = await waitForDatabase(uri, child, true);
    }
    const metadata = await loadMetadata(metadataPath);
    await initializeCollections(client.db('all_in_gym'), metadata);
    if (seed) await seedWorkspace(client, metadata);
    return {
      client, child, uri, secrets, metadata,
      async stop() {
        try { await client.db('admin').command({ shutdown: 1, force: false }); } catch { /* shutdown closes the connection */ }
        await client.close();
        if (child.exitCode === null) await Promise.race([new Promise((resolve) => child.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 10_000))]);
        if (child.exitCode === null) child.kill();
      },
    };
  } catch (error) { await client?.close(); child.kill(); throw error; }
}

async function seedWorkspace(client, metadata) {
  const db = client.db('all_in_gym');
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      if (await db.collection('Tenant').findOne({ _id: 'offline-club' }, { session })) return;
      await db.collection('Tenant').insertOne(makeDocument(metadata, 'Tenant', { id: 'offline-club', slug: 'all-in-gym', name: 'All in Gym', rootDomainAlias: '127.0.0.1' }), { session });
      await db.collection('ClubSettings').insertOne(makeDocument(metadata, 'ClubSettings', { id: 'offline-settings', tenantId: 'offline-club', clubName: 'All in Gym', registrationOnly: false }), { session });
      for (const moduleKey of ['CLASS_MANAGEMENT', 'GYM_ACCESS']) await db.collection('TenantModule').insertOne(makeDocument(metadata, 'TenantModule', { id: `offline-${moduleKey}`, tenantId: 'offline-club', moduleKey, status: 'ENABLED', enabledAt: new Date() }), { session });
    });
  } finally { await session.endSession(); }
}

export function localEnvironment(database, accessToken) {
  return {
    OFFLINE_DESKTOP: '1', OFFLINE_TENANT_ID: 'offline-club', OFFLINE_ACCESS_TOKEN: accessToken,
    OFFLINE_ACCOUNT_CREATION_DISABLED: database.secrets.accountCreationDisabled === true ? '1' : '0',
    DATABASE_URL: database.uri, AUTH_SECRET: database.secrets.authSecret,
    ACCESS_CREDENTIAL_SECRET: database.secrets.credentialSecret, AUTH_COOKIE_SECURE: 'false',
    APP_NAME: 'We Discipline', NEXT_PUBLIC_APP_NAME: 'We Discipline', NEXT_PUBLIC_OFFLINE: '1',
    DEFAULT_TENANT_SLUG: 'all-in-gym', SAAS_ROOT_DOMAIN: 'localhost', APP_TIMEZONE: 'Africa/Tunis',
    // Store date-only validity in UTC; business-day displays use APP_TIMEZONE.
    // This keeps Windows daylight-saving changes from shifting imported end dates.
    TZ: 'UTC',
    RATE_LIMIT_BACKEND: 'memory', RESEND_API_KEY: '', PASSWORD_RESET_FROM: '',
    RATE_LIMIT_REDIS_REST_URL: '', RATE_LIMIT_REDIS_REST_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
    NEXT_TELEMETRY_DISABLED: '1',
  };
}
