import { _electron as electron } from 'playwright';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const parent = path.resolve('artifacts/desktop-smoke');
await mkdir(parent, { recursive: true });
const dataDir = await mkdtemp(path.join(parent, 'profile-'));
const executablePath = path.resolve(process.argv[2] ?? 'release/win-unpacked/All in Gym.exe');
const launchArgs = process.env.GYM_TEST_SOURCE === '1' ? [path.resolve('desktop')] : [];
const testPassword = 'Local-test-password-2026';
const environment = { ...process.env, GYM_DATA_DIR: dataDir, GYM_TEST_HIDE_WINDOW: '1' };
delete environment.ELECTRON_RUN_AS_NODE;
let application;
let page;
const errors = [];
const visited = [];
try {
  application = await electron.launch({ executablePath, args: launchArgs, env: environment, timeout: 120_000 });
  application.process().stderr.on('data', (data) => process.stderr.write(data));
  application.process().stdout.on('data', (data) => process.stdout.write(data));
  page = await application.firstWindow({ timeout: 120_000 });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForURL('**/offline-setup', { timeout: 60_000 });
  await page.getByLabel('Nom du club').fill('All in Gym offline test');
  await page.getByLabel('Votre nom').fill('Local Administrator');
  await page.getByLabel('Email de connexion').fill('offline-test@example.test');
  await page.getByLabel('Mot de passe').fill(testPassword);
  const setupResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/offline/setup');
  await page.getByRole('button', { name: 'Créer mon espace local' }).click();
  const setupResult = await setupResponse;
  if (setupResult.status() !== 201) assert.fail(await setupResult.text());
  await page.waitForURL('**/login');
  await page.getByLabel('Email', { exact: true }).fill('offline-test@example.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill(testPassword);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 60_000 });
  const origin = new URL(page.url()).origin;
  assert.equal((await fetch(`${origin}/api/ready`)).status, 403, 'local API must reject requests outside the app');
  const remoteProbe = await page.evaluate(async () => {
    try { await fetch('https://example.com/', { mode: 'no-cors' }); return 'reachable'; } catch { return 'blocked'; }
  });
  assert.equal(remoteProbe, 'blocked');
  for (const route of ['/enrollment', '/members', '/payments', '/sessions', '/groups', '/coaches', '/gym/check-in', '/gym/visits', '/plans', '/offers', '/settings/club']) {
    const response = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    assert.equal(response.status(), 200, `${route} must load offline`);
    assert.equal(new URL(page.url()).pathname, route === '/plans' ? '/subscription-plans' : route);
    assert.ok(!(await page.locator('body').innerText()).includes('Application error'), `${route} must render`);
    visited.push(route);
  }
  await page.goto(`${origin}/enrollment`);
  await page.screenshot({ path: path.join(parent, 'enrollment.png'), fullPage: true });
  const account = await page.evaluate(() => fetch('/api/account').then((response) => response.json()));
  assert.equal(account.data.role, 'ADMIN');
  await application.close(); application = null;
  // Confirm profile, local login and data survive a complete application restart.
  application = await electron.launch({ executablePath, args: launchArgs, env: environment, timeout: 120_000 });
  const restarted = await application.firstWindow({ timeout: 120_000 });
  await restarted.waitForURL('**/login', { timeout: 60_000 });
  const secrets = JSON.parse(await readFile(path.join(dataDir, 'local-secrets.json'), 'utf8'));
  assert.equal(new URL(restarted.url()).port, String(secrets.applicationPort));
  await restarted.getByLabel('Email', { exact: true }).fill('offline-test@example.test');
  await restarted.getByLabel('Mot de passe', { exact: true }).fill(testPassword);
  await restarted.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await restarted.waitForURL((url) => !url.pathname.includes('login'), { timeout: 60_000 });
  assert.deepEqual(errors, []);
  await writeFile(path.join(parent, 'result.json'), JSON.stringify({ passed: true, visited, externalNetworkBlocked: true, localApiProtected: true, restartPassed: true, pageErrors: errors }, null, 2));
  console.log('Packaged desktop: setup, login, 11 workflows, network isolation and restart passed.');
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(parent, 'failure.png'), fullPage: true }).catch(() => {});
    console.error((await page.locator('body').innerText().catch(() => '')).slice(0, 3000));
  }
  throw error;
} finally { await application?.close(); }
