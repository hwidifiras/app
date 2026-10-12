import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { startLocalDatabase, localEnvironment } from '../offline/runtime.mjs';
import { saveBackup, restoreBackup } from '../offline/storage.mjs';

test('production local server supports setup, login, member writes, eleven screens, backups and restart', async () => {
  const parent = path.resolve('artifacts/server-smoke');
  await mkdir(parent, { recursive: true });
  const dataDir = await mkdtemp(path.join(parent, 'profile-'));
  const databaseOptions = { dataDir, binary: path.resolve('desktop/vendor/mongodb/bin/mongod.exe'), metadataPath: path.resolve('offline/model-metadata.json') };
  let database = await startLocalDatabase(databaseOptions);
  const accessToken = randomBytes(48).toString('base64url');
  let server;
  let cookie = '';
  const origin = `http://127.0.0.1:${database.secrets.applicationPort}`;
  const visited = [];
  const serverFile = path.resolve(process.env.GYM_SERVER_FILE ?? 'release/win-unpacked/resources/web/server.js');
  async function startServer() {
    const environment = { ...process.env, ...localEnvironment(database, accessToken), NODE_ENV: 'production', PORT: String(database.secrets.applicationPort), HOSTNAME: '127.0.0.1' };
    delete environment.NODE_OPTIONS; delete environment.ELECTRON_RUN_AS_NODE;
    server = spawn(process.execPath, [serverFile], { cwd: path.dirname(serverFile), env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    server.stdout.on('data', () => {}); server.stderr.on('data', () => {});
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      try { if ((await request('/api/ready')).ok) return; } catch { /* starting */ }
      if (server.exitCode !== null) throw new Error('Local server failed to start.');
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('Local server startup timed out.');
  }
  async function stopServer() {
    if (!server || server.exitCode !== null) return;
    const previous = server;
    const exited = new Promise((resolve) => previous.once('exit', resolve));
    previous.kill(); await exited;
  }
  function request(route, options = {}) {
    return fetch(`${origin}${route}`, { ...options, headers: { 'x-offline-access': accessToken, Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  }
  try {
    await startServer();
    assert.equal((await fetch(`${origin}/api/ready`)).status, 403);
    const rejected = await request('/api/offline/setup', { method: 'POST', headers: { Origin: 'https://example.test' }, body: '{}' });
    assert.equal(rejected.status, 403);
    const setup = await request('/api/offline/setup', { method: 'POST', body: JSON.stringify({ clubName: 'Offline acceptance club', name: 'Local Administrator', email: 'offline-acceptance@example.test', password: 'Local-test-password-2026' }) });
    assert.equal(setup.status, 201, await setup.text());
    const duplicate = await request('/api/offline/setup', { method: 'POST', body: JSON.stringify({ clubName: 'Other club', name: 'Second Administrator', email: 'second@example.test', password: 'Local-test-password-2026' }) });
    assert.equal(duplicate.status, 409);
    const login = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'offline-acceptance@example.test', password: 'Local-test-password-2026' }) });
    assert.equal(login.status, 200, await login.text());
    cookie = login.headers.get('set-cookie').split(';')[0];
    const account = await (await request('/api/account')).json();
    assert.equal(account.data.role, 'ADMIN');
    assert.equal(account.data.operationsAllowed, true);
    assert.deepEqual(account.data.modules.sort(), ['CLASS_MANAGEMENT', 'GYM_ACCESS']);
    async function create(route, data) {
      const response = await request(route, { method: 'POST', body: JSON.stringify(data) });
      const body = await response.json();
      assert.equal(response.status, 201, JSON.stringify(body));
      return body.data;
    }
    const sport = await create('/api/sports', { name: 'Offline fitness' });
    const coach = await create('/api/coaches', { firstName: 'Local', lastName: 'Coach', phone: '987654321', qualifiedSportIds: [sport.id] });
    const group = await create('/api/groups', { name: 'Offline adults', groupType: 'ADULTS', genderPolicy: 'MIXED', sportId: sport.id, coachId: coach.id, capacity: 20 });
    const plan = await create('/api/subscription-plans', { name: 'Offline gym pass', price: 5000, planKind: 'GYM', validityDays: 30, entitlements: [{ type: 'GYM_ACCESS', gymAccessMode: 'UNLIMITED' }] });
    const member = await request('/api/members', { method: 'POST', body: JSON.stringify({ firstName: 'Offline', lastName: 'Persisted Member', phone: '123456789', memberType: 'ADULT', gender: 'MALE', birthDate: '1990-01-01T00:00:00.000Z', groupId: group.id, subscriptionPlanId: plan.id, paymentAmount: 5000, paymentMethod: 'CASH' }) });
    assert.equal(member.status, 201, await member.text());
    for (const route of ['/enrollment', '/members', '/payments', '/sessions', '/groups', '/coaches', '/gym/check-in', '/gym/visits', '/plans', '/offers', '/settings/club']) {
      const response = await request(route);
      assert.equal(response.status, 200, route);
      const html = await response.text();
      assert.ok(!html.includes('Application error'), route);
      visited.push(route);
    }
    await stopServer();
    const snapshot = path.join(dataDir, 'test.gymbackup');
    await saveBackup(database.client, snapshot, database.metadata, database.secrets.credentialSecret);
    await database.client.db('all_in_gym').collection('Member').deleteMany({});
    const restored = await restoreBackup(database.client, snapshot, database.metadata);
    assert.equal(restored.credentials.accessCredentialSecret, database.secrets.credentialSecret);
    await database.stop();
    database = await startLocalDatabase(databaseOptions);
    await startServer();
    const members = await (await request('/api/members')).json();
    assert.ok(JSON.stringify(members).includes('Persisted Member'));
    const accountAfterRestart = await request('/api/account');
    assert.equal(accountAfterRestart.status, 200);
    await writeFile(path.join(parent, 'result.json'), JSON.stringify({ passed: true, visited, setup: true, login: true, memberWrite: true, localApiProtected: true, crossOriginRejected: true, backupRestore: true, restartPersistence: true }, null, 2));
  } finally {
    await stopServer(); await database.stop();
    if (!dataDir.startsWith(parent + path.sep)) throw new Error('Invalid disposable profile');
    await rm(dataDir, { recursive: true, force: true });
  }
});
