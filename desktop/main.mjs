import { app, BrowserWindow, Menu, dialog, session, utilityProcess, ipcMain, safeStorage } from 'electron';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalDatabase, localEnvironment, persistLocalSecrets } from './offline/runtime.mjs';
import { saveBackup, readBackup } from './offline/storage.mjs';
import { decryptRecovery, recoverProfile } from './offline/recovery.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
// Preserve the existing profile and installer identity across the brand change.
app.setName('We Discipline');
app.setPath('userData', process.env.GYM_DATA_DIR ? path.resolve(process.env.GYM_DATA_DIR) : path.join(app.getPath('appData'), 'All in Gym'));
if (!app.requestSingleInstanceLock()) app.quit();
let database, server, window, origin, closing = false, maintenance = false, operationBusy = false;
let serverFailed = false;
const accessToken = randomBytes(48).toString('base64url');
let dataDir;
let bundledRecoveryAvailable = false;
const recoveryFile = () => app.isPackaged ? path.join(process.resourcesPath, 'recovery/original.gymrecovery') : path.join(root, 'recovery/original.gymrecovery');
function diagnostic(message) {
  const safe = String(message).replace(/mongodb:\/\/\S+/g, '[local database]').slice(0, 2500);
  console.error(safe);
  if (dataDir) writeFile(path.join(dataDir, 'startup-diagnostic.txt'), safe).catch(() => {});
}

function localUrl(url) { try { return new URL(url).origin === origin; } catch { return false; } }

function spawnServer(port) {
  serverFailed = false;
  const serverPath = app.isPackaged ? path.join(process.resourcesPath, 'web/server.js') : path.join(root, 'web/server.js');
  const environment = { ...process.env, ...localEnvironment(database, accessToken), GYM_DATA_DIR: dataDir, OFFLINE_BUNDLED_RECOVERY: bundledRecoveryAvailable ? '1' : '0', NODE_ENV: 'production', PORT: String(port), HOSTNAME: '127.0.0.1' };
  // Debugger/module-loader flags belong to the parent, never the local server.
  delete environment.NODE_OPTIONS;
  delete environment.ELECTRON_RUN_AS_NODE;
  server = utilityProcess.fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    env: environment,
    stdio: 'pipe', serviceName: 'We Discipline local application',
  });
  const instance = server;
  server.stdout?.on('data', () => {});
  server.stderr?.on('data', (buffer) => {
    // Keep startup diagnostics free of credentials and member data.
    const text = buffer.toString().replace(/mongodb:\/\/\S+/g, '[local database]');
    if (/Error|failed/i.test(text)) diagnostic(text);
  });
  instance.on('exit', (code) => {
    // A delayed exit from the service being replaced must not fail its successor.
    if (server !== instance) return;
    serverFailed = true;
    if (!closing && !maintenance) {
      diagnostic(`Local application service exited (${code}).`);
      if (window && process.env.GYM_TEST_HIDE_WINDOW !== '1') dialog.showErrorBox('Application arrêtée', 'Le service local s’est arrêté. Fermez puis relancez We Discipline. Vos données sont conservées.');
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
  const exited = new Promise((resolve) => previous.once('exit', resolve));
  previous.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 15_000))]);
}

async function authenticatedAdmin() {
  const cookies = await session.defaultSession.cookies.get({ url: origin });
  const response = await fetch(`${origin}/api/account`, { headers: { 'x-offline-access': accessToken, Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') } });
  const account = await response.json();
  if (!response.ok || account.data?.role !== 'ADMIN') throw new Error('Connectez-vous avec un compte administrateur pour utiliser cette fonction.');
}

async function backup(file) { return saveBackup(database.client, file, database.metadata, database.secrets.credentialSecret, { dataDir, accountCreationDisabled: database.secrets.accountCreationDisabled }); }

async function backupMenu() {
  if (maintenance || operationBusy) return { error: 'Une opération est déjà en cours.' };
  operationBusy = true;
  let ownsMaintenance = false;
  try {
    if (maintenance) throw new Error('Une opération est déjà en cours.');
    await authenticatedAdmin();
    const chosen = await dialog.showSaveDialog(window, { title: 'Sauvegarder We Discipline', defaultPath: `We-Discipline-${new Date().toISOString().slice(0, 10)}.gymbackup`, filters: [{ name: 'Sauvegarde We Discipline', extensions: ['gymbackup'] }] });
    if (chosen.canceled || !chosen.filePath) return { canceled: true };
    maintenance = true; ownsMaintenance = true; await stopServer();
    await backup(chosen.filePath);
    await dialog.showMessageBox(window, { message: 'Sauvegarde terminée.', detail: chosen.filePath });
    return { ok: true };
  } catch (error) { return { error: error.message }; }
  finally { try { if (ownsMaintenance) { spawnServer(Number(new URL(origin).port)); await waitForServer(); } } finally { if (ownsMaintenance) maintenance = false; operationBusy = false; } }
}

async function restoreMenu() {
  if (maintenance || operationBusy) return { error: 'Une opération est déjà en cours.' };
  operationBusy = true;
  let ownsMaintenance = false;
  try {
    if (maintenance) throw new Error('Une opération est déjà en cours.');
    await authenticatedAdmin();
    const chosen = await dialog.showOpenDialog(window, { title: 'Restaurer We Discipline', properties: ['openFile'], filters: [{ name: 'Sauvegarde We Discipline', extensions: ['gymbackup'] }] });
    if (chosen.canceled) return { canceled: true };
    const data = await readBackup(chosen.filePaths[0], database.metadata);
    const answer = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Restaurer'], defaultId: 0, cancelId: 0, message: 'Remplacer les données locales par cette sauvegarde ?', detail: 'Une sauvegarde de sécurité sera créée avant le remplacement.' });
    if (answer.response !== 1) return { canceled: true };
    maintenance = true; ownsMaintenance = true; await stopServer();
    await recoverProfile(database, dataDir, data);
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    return { ok: true };
  } catch (error) { return { error: error.message }; }
  finally { try { if (ownsMaintenance) { spawnServer(Number(new URL(origin).port)); await waitForServer(); await window.loadURL(`${origin}/login`); } } finally { if (ownsMaintenance) maintenance = false; operationBusy = false; } }
}

async function recoveryStatus() {
  const users = await database.client.db('all_in_gym').collection('User').countDocuments({ tenantId: 'offline-club' });
  let archive;
  try { archive = await readFile(recoveryFile(), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const hash = archive ? createHash('sha256').update(archive).digest('hex') : null;
  let cachedPassword;
  if (hash && safeStorage.isEncryptionAvailable()) {
    try {
      const cached = JSON.parse(await readFile(path.join(dataDir, 'recovery-access.json'), 'utf8'));
      if (cached.sha256 === hash) cachedPassword = safeStorage.decryptString(Buffer.from(cached.encrypted, 'base64'));
    } catch { /* Ask for the archive password again when the local cache is unavailable. */ }
  }
  return { archive, hash, cachedPassword, firstLaunch: users === 0 };
}

async function restoreOriginal(password) {
  if (maintenance || operationBusy) return { error: 'Une opération est déjà en cours.' };
  operationBusy = true;
  let ownsMaintenance = false;
  try {
    if (maintenance) throw new Error('Une opération est déjà en cours.');
    const status = await recoveryStatus();
    if (!status.firstLaunch) await authenticatedAdmin();
    if (!status.archive) throw new Error('Aucune archive originale incluse dans cette installation.');
    const passphrase = typeof password === 'string' && password ? password : status.cachedPassword;
    if (!passphrase) throw new Error('Saisissez le mot de passe de récupération.');
    const data = await decryptRecovery(status.archive, passphrase, database.metadata);
    if (!status.firstLaunch) {
      const answer = await dialog.showMessageBox(window, { type: 'warning', buttons: ['Annuler', 'Restaurer'], defaultId: 0, cancelId: 0, message: 'Restaurer les données originales du client ?', detail: 'Les modifications locales seront remplacées. Une sauvegarde de sécurité complète sera conservée automatiquement.' });
      if (answer.response !== 1) return { canceled: true };
    }
    maintenance = true; ownsMaintenance = true; await stopServer();
    await recoverProfile(database, dataDir, data);
    await session.defaultSession.clearCache();
    // Windows protects this cache for the current Windows user; no password is bundled in the executable.
    if (safeStorage.isEncryptionAvailable()) {
      await writeFile(path.join(dataDir, 'recovery-access.json'), JSON.stringify({ sha256: status.hash, encrypted: safeStorage.encryptString(passphrase).toString('base64') }), { mode: 0o600, flush: true }).catch(() => {});
    }
    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    return { ok: true };
  } catch (error) { return { error: error.message }; }
  finally { try { if (ownsMaintenance) { spawnServer(Number(new URL(origin).port)); await waitForServer(); await window.loadURL(`${origin}/login`); } } finally { if (ownsMaintenance) maintenance = false; operationBusy = false; } }
}

function installBridge() {
  const handle = (name, operation) => ipcMain.handle(name, async (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !localUrl(event.senderFrame.url)) throw new Error('Accès local refusé.');
    const pathname = new URL(event.senderFrame.url).pathname;
    if (!['/settings/data-import', '/settings/offline-data', '/offline-recovery', ...(name === 'offline:status' ? ['/login'] : [])].includes(pathname)) throw new Error('Écran de récupération requis.');
    return operation(...args);
  });
  handle('offline:status', async () => { const state = await recoveryStatus(); return { originalAvailable: Boolean(state.archive), passwordRequired: !state.cachedPassword, firstLaunch: state.firstLaunch, busy: maintenance || operationBusy }; });
  handle('offline:backup', backupMenu);
  handle('offline:restore-file', restoreMenu);
  handle('offline:restore-original', restoreOriginal);
}

function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'We Discipline', submenu: [
      { label: 'Données et récupération', click: () => window.loadURL(`${origin}/settings/offline-data`) },
      { label: 'Sauvegarder…', click: async () => { const result = await backupMenu(); if (result?.error) dialog.showErrorBox('Sauvegarde', result.error); } }, { label: 'Restaurer…', click: async () => { const result = await restoreMenu(); if (result?.error) dialog.showErrorBox('Restauration', result.error); } },
      { type: 'separator' }, { label: 'Imprimer…', accelerator: 'CmdOrCtrl+P', click: () => BrowserWindow.getFocusedWindow()?.webContents.print({ silent: false }) },
      { type: 'separator' }, { role: 'quit', label: 'Quitter' },
    ] },
    { label: 'Édition', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'Affichage', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: 'Aide', submenu: [{ label: 'À propos', click: () => dialog.showMessageBox(window, { message: `We Discipline ${app.getVersion()}`, detail: 'Édition locale hors connexion. Les données sont enregistrées sur cet ordinateur. Sauvegardez régulièrement sur un autre support.' }) }] },
  ]));
}

app.on('second-instance', () => { window?.show(); window?.focus(); });
app.whenReady().then(async () => {
  dataDir = app.getPath('userData');
  await mkdir(dataDir, { recursive: true });
  database = await startLocalDatabase({ dataDir, binary: app.isPackaged ? path.join(process.resourcesPath, 'mongodb/bin/mongod.exe') : path.join(root, 'vendor/mongodb/bin/mongod.exe'), metadataPath: path.join(root, 'offline/model-metadata.json') });
  bundledRecoveryAvailable = Boolean((await recoveryStatus()).archive);
  if (bundledRecoveryAvailable && !database.secrets.accountCreationDisabled) {
    database.secrets.accountCreationDisabled = true;
    await persistLocalSecrets(dataDir, database.secrets);
  }
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
  window = new BrowserWindow({ ...bounds, minWidth: 900, minHeight: 650, title: 'We Discipline', icon: path.join(root, 'assets/we-discipline.png'), show: false, webPreferences: { preload: path.join(root, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  window.webContents.on('page-title-updated', (event) => { event.preventDefault(); window.setTitle('We Discipline'); });
  window.once('ready-to-show', () => { if (process.env.GYM_TEST_HIDE_WINDOW !== '1') window.show(); });
  window.on('close', (event) => { if (maintenance || operationBusy) event.preventDefault(); });
  window.on('resize', () => { const [width, height] = window.getSize(); writeFile(path.join(dataDir, 'window.json'), JSON.stringify({ width, height })).catch(() => {}); });
  installMenu();
  installBridge();
  const users = await database.client.db('all_in_gym').collection('User').countDocuments({ tenantId: 'offline-club' });
  const recovery = await recoveryStatus();
  await window.loadURL(`${origin}/${users ? 'login' : recovery.archive ? 'offline-recovery' : 'offline-setup'}`);
}).catch(async (error) => {
  diagnostic(error.stack ?? error.message);
  if (process.env.GYM_TEST_HIDE_WINDOW !== '1') dialog.showErrorBox('We Discipline — démarrage', `${error.message}\nLes données existantes ne sont pas supprimées.`);
  await database?.stop(); app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (maintenance || operationBusy) { event.preventDefault(); return; }
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
