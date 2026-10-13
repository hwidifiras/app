import { _electron as electron } from 'playwright';
import { MongoClient } from 'mongodb';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadMetadata } from '../offline/storage.mjs';
import { decryptRecovery } from '../offline/recovery.mjs';

// Client-specific credentials are accepted only on stdin, never committed or logged.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const credentials = JSON.parse(input);
const executablePath = path.resolve(process.argv[2] ?? 'release/win-unpacked/We Discipline.exe');
const resources = path.join(path.dirname(executablePath), 'resources');
const metadata = await loadMetadata(path.resolve('offline/model-metadata.json'));
const expected = await decryptRecovery(await readFile(path.join(resources, 'recovery/original.gymrecovery'), 'utf8'), credentials.password, metadata);
const parent = path.resolve('artifacts/native-recovery');
await mkdir(parent, { recursive: true });
const dataDir = await mkdtemp(path.join(parent, 'profile-'));
const env = { ...process.env, GYM_DATA_DIR: dataDir, GYM_TEST_HIDE_WINDOW: '1' };
delete env.NODE_OPTIONS; delete env.ELECTRON_RUN_AS_NODE;
let application, client;
const hash = (value) => createHash('sha256').update(value).digest('hex');
try {
  application = await electron.launch({ executablePath, env, timeout: 60_000 });
  const page = await application.firstWindow({ timeout: 60_000 });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForURL('**/offline-recovery', { timeout: 60_000 });
  assert.equal(await page.evaluate(() => typeof window.weDisciplineDesktop?.restoreOriginal), 'function');
  const wrong = await page.evaluate(() => window.weDisciplineDesktop.restoreOriginal('Incorrect-archive-password'));
  assert.match(wrong.error, /incorrect/);
  const secrets = JSON.parse(await readFile(path.join(dataDir, 'local-secrets.json'), 'utf8'));
  client = new MongoClient(`mongodb://allInGym:${encodeURIComponent(secrets.databasePassword)}@127.0.0.1:${secrets.databasePort}/all_in_gym?authSource=admin&replicaSet=allInGymLocal&directConnection=true`);
  await client.connect();
  assert.equal(await client.db('all_in_gym').collection('User').countDocuments(), 0);
  await page.getByLabel(/^Mot de passe de récupération/).fill(credentials.password);
  await page.getByRole('button', { name: 'Restaurer les données originales', exact: true }).click();
  await page.waitForURL('**/login', { timeout: 60_000 });
  await page.waitForFunction(async () => !(await window.weDisciplineDesktop.status()).busy);
  for (const name of Object.keys(metadata.models)) {
    const actual = await client.db('all_in_gym').collection(name).find({}).toArray();
    const ordered = (rows) => JSON.stringify(rows.map((row) => Object.fromEntries(Object.keys(row).sort().map((key) => [key, row[key]]))).sort((a, b) => a._id.localeCompare(b._id)));
    assert.equal(hash(ordered(actual)), hash(ordered(expected.collections[name])), `Original records differ: ${name}`);
  }
  assert.equal(hash(await readFile(path.join(dataDir, 'branding/club-logo.jpg'))), hash(Buffer.from(expected.branding['club-logo.jpg'], 'base64')));
  // Once accounts exist, an unauthenticated renderer cannot restore even with its cached archive access.
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/offline-recovery`);
  assert.match((await page.evaluate(() => window.weDisciplineDesktop.restoreOriginal())).error, /administrateur/);
  await page.goto(`${origin}/login`);
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 60_000 });
  await page.goto(`${origin}/settings/offline-data`);
  await page.getByText('Récupération en un clic disponible sur cet ordinateur.', { exact: true }).waitFor();
  const first = expected.collections.Member[0];
  await client.db('all_in_gym').collection('Member').updateOne({ _id: first._id }, { $set: { firstName: 'Disposable local recovery test' } });
  // Only the disposable test app has its confirmation dialog replaced by the test.
  await application.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false }); });
  await page.getByRole('button', { name: 'Restaurer les données originales', exact: true }).click();
  await page.waitForURL('**/login', { timeout: 60_000 });
  await page.waitForFunction(async () => !(await window.weDisciplineDesktop.status()).busy);
  assert.equal((await client.db('all_in_gym').collection('Member').findOne({ _id: first._id })).firstName, first.firstName);
  const after = JSON.parse(await readFile(path.join(dataDir, 'local-secrets.json'), 'utf8'));
  assert.equal(after.accountCreationDisabled, true);
  assert.equal(after.credentialSecret, expected.credentials.accessCredentialSecret);
  assert.deepEqual(errors, []);
  await writeFile(path.join(parent, 'result.json'), JSON.stringify({ passed: true, firstLaunchRestore: true, originalRecordHashesMatch: true, wrongPasswordRejected: true, unauthenticatedRestoreRejected: true, oneClickRestore: true, accountCreationLocked: true, cardKeyAndLogoPreserved: true }, null, 2));
  console.log('Native encrypted recovery: original records, logo, fixed login, one-click restore and access guards passed.');
} finally {
  await client?.close();
  await application?.close();
  if (!dataDir.startsWith(parent + path.sep)) throw new Error('Invalid disposable recovery profile');
  await rm(dataDir, { recursive: true, force: true });
}
