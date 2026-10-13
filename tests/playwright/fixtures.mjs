import { test as base, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { startLocalDatabase, localEnvironment } from '../../offline/runtime.mjs';
import { provisionLocalAccount } from '../../offline/accounts.mjs';

export const credentials = { email: 'playwright-admin@example.test', password: 'E2e-local-password-2026', name: 'Playwright Administrator' };

export const test = base.extend({
  accountMode: ['locked', { option: true, scope: 'worker' }],
  signedIn: [true, { option: true }],
  runtime: [async ({ playwright, accountMode }, provide) => {
    const parent = path.resolve('artifacts/playwright/profiles');
    await mkdir(parent, { recursive: true });
    const dataDir = await mkdtemp(path.join(parent, 'test-'));
    const serverFile = path.resolve('release/win-unpacked/resources/web/server.js');
    const databaseOptions = { dataDir, binary: path.resolve('desktop/vendor/mongodb/bin/mongod.exe'), metadataPath: path.resolve('offline/model-metadata.json') };
    let database, server, api;
    const accessToken = randomBytes(48).toString('base64url');
    let origin;
    async function stopServer() {
      if (!server || server.exitCode !== null || server.signalCode !== null) return;
      const previous = server;
      const exit = new Promise((resolve) => previous.once('exit', resolve));
      previous.kill();
      let timeout;
      try { await Promise.race([exit, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Local test server did not stop')), 10_000); })]); }
      finally { clearTimeout(timeout); }
      server = null;
    }
    async function startServer() {
      const env = { ...process.env, ...localEnvironment(database, accessToken), GYM_DATA_DIR: dataDir, NODE_ENV: 'production', PORT: String(database.secrets.applicationPort), HOSTNAME: '127.0.0.1' };
      delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
      let startupError;
      server = spawn(process.execPath, [serverFile], { cwd: path.dirname(serverFile), env, windowsHide: true, stdio: 'ignore' });
      server.once('error', (error) => { startupError = error; });
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        if (startupError) throw startupError;
        if (server.exitCode !== null || server.signalCode !== null) throw new Error('The packaged local server exited during startup');
        try { if ((await fetch(`${origin}/api/ready`, { headers: { 'x-offline-access': accessToken }, signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* starting */ }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      throw new Error('The packaged local server did not become ready');
    }
    try {
      await access(serverFile).catch(() => { throw new Error('Build the offline resources with pnpm desktop:package before running Playwright.'); });
      database = await startLocalDatabase(databaseOptions);
      if (accountMode === 'locked') await provisionLocalAccount(database, dataDir, credentials);
      origin = `http://127.0.0.1:${database.secrets.applicationPort}`;
      await startServer();
      api = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { 'x-offline-access': accessToken, Origin: origin } });
      let storageState = { cookies: [], origins: [] };
      if (accountMode === 'locked') {
        const login = await api.post('/api/auth/login', { data: credentials });
        expect(login.status()).toBe(200);
        storageState = await api.storageState();
      }
      await provide({
        origin, accessToken, storageState,
        async restart() {
          await stopServer(); await database.stop();
          database = await startLocalDatabase(databaseOptions);
          await startServer();
        },
      });
    } finally {
      await api?.dispose();
      try { await stopServer(); } finally {
        await database?.stop();
        if (!dataDir.startsWith(parent + path.sep)) throw new Error('Invalid disposable Playwright profile');
        await rm(dataDir, { force: true, recursive: true });
      }
    }
  }, { scope: 'worker', timeout: 90_000 }],
  baseURL: async ({ runtime }, provide) => provide(runtime.origin),
  extraHTTPHeaders: async ({ runtime }, provide) => provide({ 'x-offline-access': runtime.accessToken, Origin: runtime.origin }),
  storageState: async ({ runtime, signedIn }, provide) => provide(signedIn ? runtime.storageState : { cookies: [], origins: [] }),
  page: async ({ page, runtime }, provide) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Exercise the compiled UI with external network access unavailable.
    // This does not substitute for Electron's separate native network controls.
    await page.context().route('**/*', (route) => new URL(route.request().url()).origin === runtime.origin ? route.continue() : route.abort());
    await provide(page);
    expect(errors, 'Uncaught browser errors').toEqual([]);
  },
});

export { expect };

export async function login(page, password = credentials.password) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  const response = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/login');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  return response;
}

export async function createPaidMember(request, suffix) {
  async function create(route, data) {
    const response = await request.post(route, { data });
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()).data;
  }
  const sport = await create('/api/sports', { name: `Fitness ${suffix}` });
  const coach = await create('/api/coaches', { firstName: 'Local', lastName: `Coach ${suffix}`, phone: `99${suffix}`, qualifiedSportIds: [sport.id] });
  const group = await create('/api/groups', { name: `Adults ${suffix}`, groupType: 'ADULTS', genderPolicy: 'MIXED', sportId: sport.id, coachId: coach.id, capacity: 20 });
  const plan = await create('/api/subscription-plans', { name: `Gym ${suffix}`, price: 5000, planKind: 'GYM', validityDays: 30, entitlements: [{ type: 'GYM_ACCESS', gymAccessMode: 'UNLIMITED' }] });
  return create('/api/members', { firstName: 'Playwright', lastName: `Member ${suffix}`, phone: `88${suffix}`, memberType: 'ADULT', gender: 'MALE', birthDate: '1990-01-01T00:00:00.000Z', groupId: group.id, subscriptionPlanId: plan.id, paymentAmount: 5000, paymentMethod: 'CASH' });
}
