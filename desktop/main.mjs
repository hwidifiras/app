import { app, BrowserWindow, Menu, dialog, session, utilityProcess } from 'electron';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalDatabase, localEnvironment, persistLocalSecrets } from './offline/runtime.mjs';
import { saveBackup, restoreBackup } from './offline/storage.mjs';
import { syncProfileBranding } from './offline/branding.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
app.setName('All in Gym');
if (process.env.GYM_DATA_DIR) app.setPath('userData', path.resolve(process.env.GYM_DATA_DIR));
if (!app.requestSingleInstanceLock()) app.quit();
let database, server, window, origin, closing = false, maintenance = false;
let serverFailed = false;
const accessToken = randomBytes(48).toString('base64url');
let dataDir;
function diagnostic(message) {
  const safe = String(message).replace(/mongodb:\/\/\S+/g, '[local database]').slice(0, 2500);
  console.error(safe);
  if (dataDir) writeFile(path.join(dataDir, 'startup-diagnostic.txt'), safe).catch(() => {});
}

function localUrl(url) { try { return new URL(url).origin === origin; } catch { return false; } }

function spawnServer(port) {
  serverFailed = false;
  const serverPath = app.isPackaged ? path.join(process.resourcesPath, 'web/server.js') : path.join(root, 'web/server.js');
  const environment = { ...process.env, ...localEnvironment(database, accessToken), NODE_ENV: 'production', PORT: String(port), HOSTNAME: '127.0.0.1' };
  // Debugger/module-loader flags belong to the parent, never the local server.
  delete environment.NODE_OPTIONS;
  delete environment.ELECTRON_RUN_AS_NODE;
  server = utilityProcess.fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    env: environment,
    stdio: 'pipe', serviceName: 'All in Gym local application',
  });
  server.stdout?.on('data', () => {});
  server.stderr?.on('data', (buffer) => {
    // Keep startup diagnostics free of credentials and member data.
    const text = buffer.toString().replace(/mongodb:\/\/\S+/g, '[local database]');
    if (/Error|failed/i.test(text)) diagnostic(text);
  });
  server.on('exit', (code) => {
    serverFailed = true;
    if (!closing && !maintenance) {
      diagnostic(`Local application service exited (${code}).`);
      if (window && process.env.GYM_TEST_HIDE_WINDOW !== '1') dialog.showErrorBox('Application arrêtée', 'Le service local s’est arrêté. Fermez puis relancez All in Gym. Vos données sont conservées.');
    }
  });
}

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (serverFailed) throw new Error('Le service local n’a pas pu démarrer. Consultez startup-diagnostic.txt dans le dossier de données.');
    try { const response = await fetch(`${origin}/api/ready`, { headers: { 'x-offline-access': accessToken } }); if (response.ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Le service local ne répond pas.');
}

async function stopServer() {
  if (!server) return;
  const previous = server; server = null;
  previous.kill();
  await Promise.race([new Promise((resolve) => previous.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 5000))]);
}

async function authenticatedAdmin() {
  const cookies = await session.defaultSession.cookies.get({ url: origin });
  const response = await fetch(`${origin}/api/account`, { headers: { 'x-offline-access': accessToken, Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') } });
  const account = await response.json();
  if (!response.ok || account.data?.role !== 'ADMIN') throw new Error('Connectez-vous avec un compte administrateur pour utiliser cette fonction.');
}

async function backup(file) { return saveBackup(database.client, file, database.metadata, database.secrets.credentialSecret); }

async function backupMenu() {
  try {
    await authenticatedAdmin();
    const chosen = await dialog.showSaveDialog(window, { title: 'Sauvegarder All in Gym', defaultPath: `All-in-Gym-${new Date().toISOString().slice(0, 10)}.gymbackup`, filters: [{ name: 'Sauvegarde All in Gym', extensions: ['gymbackup'] }] });
    if (chosen.canceled || !chosen.filePath) return;
    maintenance = true; await stopServer();
    await backup(chosen.filePath);
    await dialog.showMessageBox(window, { message: 'Sauvegarde terminée.', detail: chosen.filePath });
  } catch (error) { dialog.showErrorBox('Sauvegarde', error.message); }
  finally { if (maintenance) { spawnServer(Number(new URL(origin).port)); await waitForServer(); maintenance = false; } }
}

async function restoreMenu() {
  try {
    await authenticatedAdmin();
    const chosen = await dialog.showOpenDialog(window, { title: 'Restaurer All in Gym', properties: ['openFile'], filters: [{ name: 'Sauvegarde All in Gym', extensions: ['gymbackup'] }] });
    if (chosen.canceled) return;
    const answer = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Restaurer'], defaultId: 0, cancelId: 0, message: 'Remplacer les données locales par cette sauvegarde ?', detail: 'Une sauvegarde de sécurité sera créée avant le remplacement.' });
    if (answer.response !== 1) return;
    maintenance = true; await stopServer();
    await backup(path.join(dataDir, 'backups', `before-restore-${Date.now()}.gymbackup`));
    const restored = await restoreBackup(database.client, chosen.filePaths[0], database.metadata);
    if (restored.credentials?.accessCredentialSecret) {
      database.secrets.credentialSecret = restored.credentials.accessCredentialSecret;
      await persistLocalSecrets(dataDir, database.secrets);
    }
    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
  } catch (error) { dialog.showErrorBox('Restauration', error.message); }
  finally { if (maintenance) { spawnServer(Number(new URL(origin).port)); await waitForServer(); maintenance = false; await window.loadURL(`${origin}/login`); } }
}

function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'All in Gym', submenu: [
      { label: 'Sauvegarder…', click: backupMenu }, { label: 'Restaurer…', click: restoreMenu },
      { type: 'separator' }, { label: 'Imprimer…', accelerator: 'CmdOrCtrl+P', click: () => BrowserWindow.getFocusedWindow()?.webContents.print({ silent: false }) },
      { type: 'separator' }, { role: 'quit', label: 'Quitter' },
    ] },
    { label: 'Édition', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Affichage', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: 'Aide', submenu: [{ label: 'À propos', click: () => dialog.showMessageBox(window, { message: `All in Gym ${app.getVersion()}`, detail: 'Édition locale hors connexion. Les données sont enregistrées sur cet ordinateur. Sauvegardez régulièrement sur un autre support.' }) }] },
  ]));
}

app.on('second-instance', () => { window?.show(); window?.focus(); });
app.whenReady().then(async () => {
  dataDir = app.getPath('userData');
  await mkdir(dataDir, { recursive: true });
  await syncProfileBranding(dataDir, app.isPackaged ? path.join(process.resourcesPath, 'web/public') : path.join(root, 'web/public'));
  database = await startLocalDatabase({ dataDir, binary: app.isPackaged ? path.join(process.resourcesPath, 'mongodb/bin/mongod.exe') : path.join(root, 'vendor/mongodb/bin/mongod.exe'), metadataPath: path.join(root, 'offline/model-metadata.json') });
  const port = database.secrets.applicationPort; origin = `http://127.0.0.1:${port}`;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !localUrl(details.url) && !details.url.startsWith('devtools:') }));
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (localUrl(details.url)) { details.requestHeaders['x-offline-access'] = accessToken; details.requestHeaders['x-forwarded-proto'] = 'http'; }
    callback({ requestHeaders: details.requestHeaders });
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(permission === 'media' && localUrl(contents.getURL())));
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => permission === 'media' && localUrl(requestingOrigin) && localUrl(contents?.getURL()));
  app.on('web-contents-created', (_, contents) => {
    contents.on('will-navigate', (event, url) => { if (!localUrl(url)) event.preventDefault(); });
    contents.setWindowOpenHandler(({ url }) => localUrl(url) ? { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } } : { action: 'deny' });
  });
  spawnServer(port); await waitForServer();
  let bounds = { width: 1440, height: 900 };
  try { const saved = JSON.parse(await readFile(path.join(dataDir, 'window.json'), 'utf8')); bounds = { width: Math.min(1920, Math.max(900, saved.width)), height: Math.min(1200, Math.max(650, saved.height)) }; } catch { /* first launch */ }
  window = new BrowserWindow({ ...bounds, minWidth: 900, minHeight: 650, title: 'All in Gym', show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  window.once('ready-to-show', () => { if (process.env.GYM_TEST_HIDE_WINDOW !== '1') window.show(); });
  window.on('close', (event) => { if (maintenance) event.preventDefault(); });
  window.on('resize', () => { const [width, height] = window.getSize(); writeFile(path.join(dataDir, 'window.json'), JSON.stringify({ width, height })).catch(() => {}); });
  installMenu();
  const users = await database.client.db('all_in_gym').collection('User').countDocuments({ tenantId: 'offline-club' });
  await window.loadURL(`${origin}/${users ? 'login' : 'offline-setup'}`);
}).catch(async (error) => {
  diagnostic(error.stack ?? error.message);
  if (process.env.GYM_TEST_HIDE_WINDOW !== '1') dialog.showErrorBox('All in Gym — démarrage', `${error.message}\nLes données existantes ne sont pas supprimées.`);
  await database?.stop(); app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (maintenance) { event.preventDefault(); return; }
  if (closing) return;
  event.preventDefault(); closing = true;
  (async () => {
    await stopServer();
    if (database) {
      try {
        await backup(path.join(dataDir, 'backups', `auto-${Date.now()}.gymbackup`));
        const names = (await readdir(path.join(dataDir, 'backups'))).filter((name) => /^auto-\d+\.gymbackup$/.test(name)).sort().reverse();
        for (const name of names.slice(14)) await unlink(path.join(dataDir, 'backups', name));
      } catch { /* Database journaling remains intact if a backup cannot be written. */ }
      await database.stop();
    }
    app.quit();
  })();
});
