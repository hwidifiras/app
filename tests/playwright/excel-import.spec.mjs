import writeExcelFile from 'write-excel-file/node';
import { readSheet } from 'read-excel-file/node';
import { test, expect } from './fixtures.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function catalog(request, suffix, kind, quota = false, firstUse = false) {
  async function create(route, data) {
    const response = await request.post(route, { data });
    expect(response.status(), await response.text()).toBe(201);
    return (await response.json()).data;
  }
  const sport = await create('/api/sports', { name: `Excel Karate ${suffix}` });
  const coach = await create('/api/coaches', { firstName: 'Excel', lastName: `Coach ${suffix}`, phone: `999${suffix}`, qualifiedSportIds: [sport.id] });
  const group = await create('/api/groups', { name: `Excel Class ${suffix}`, groupType: 'MIXED', genderPolicy: 'MIXED', sportId: sport.id, coachId: coach.id, capacity: 20 });
  const plan = await create('/api/subscription-plans', { name: `Excel ${kind} ${suffix}`, price: 6000, planKind: kind, validityDays: 30, activationPolicy: firstUse ? 'FIRST_USE' : 'FIXED_DATE', entitlements: [...(kind !== 'GYM' ? [{ type: 'CLASS_SESSIONS', sportId: sport.id, sessionsPerWeek: 2, grantedUnits: 8 }] : []), ...(kind !== 'CLASS' ? [{ type: 'GYM_ACCESS', gymAccessMode: quota ? 'VISIT_QUOTA' : 'UNLIMITED', ...(quota ? { grantedUnits: 10 } : {}) }] : [])] });
  return { sport, group, plan };
}
async function upload(page, records) {
  const buffer = await writeExcelFile(records).toBuffer();
  await page.getByLabel('Fichier Excel des élèves', { exact: true }).setInputFiles({ name: 'eleves.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  return buffer;
}
async function configure(page, data, kind) {
  await page.goto('/settings/data-import');
  await expect(page.getByRole('heading', { name: 'Importer des élèves depuis Excel' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Activité à importer', exact: true }).selectOption(kind);
  await page.getByRole('combobox', { name: 'Formule par défaut', exact: true }).selectOption(data.plan.id);
  if (kind !== 'GYM') await page.getByRole('checkbox', { name: new RegExp(data.group.name) }).check();
  const activate = page.getByRole('button', { name: 'Activer la reprise Excel', exact: true });
  if (await activate.count()) { await activate.click(); await expect(activate).toHaveCount(0); }
}
for (const { kind, quota, firstUse } of [{ kind: 'CLASS' }, { kind: 'GYM' }, { kind: 'GYM', quota: true }, { kind: 'GYM', quota: true, firstUse: true }, { kind: 'MIXED', quota: true }]) {
  test(`real Excel upload and import: ${kind}, quota ${Boolean(quota)}, first use ${Boolean(firstUse)}`, async ({ page, request }) => {
    const suffix = String(Date.now()).slice(-8);
    const data = await catalog(request, suffix, kind, quota, firstUse);
    await configure(page, data, kind);
    const phone = `00${suffix}`;
    await upload(page, [['Prénom', 'Nom', 'Type membre', 'Téléphone', 'Séances restantes', 'Visites restantes', 'Montant total', 'Déjà payé'], ['Excel', `Student ${suffix}`, 'ADULT', phone, kind === 'GYM' ? null : 3, quota ? firstUse ? 10 : 4 : null, '60,00', '20,00']]);
    const response = page.waitForResponse((item) => item.url().endsWith('/api/data-import/students') && item.request().method() === 'POST');
    await page.getByRole('button', { name: 'Vérifier le fichier Excel', exact: true }).click();
    const preview = await (await response).json();
    expect(preview.data.errorRows, JSON.stringify(preview)).toBe(0);
    await expect(page.getByText('1/1 lignes prêtes', { exact: false })).toBeVisible();
    const before = (await (await request.get('/api/members', { params: { q: phone } })).json()).data;
    expect(before.some((member) => member.phone === phone)).toBe(false);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Importer 1 élèves', exact: true }).click();
    await expect(page.getByText('1 élèves importés avec succès.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Importer 1 élèves', exact: true })).toBeDisabled();
    const after = (await (await request.get('/api/members', { params: { q: phone } })).json()).data;
    expect(after.filter((member) => member.phone === phone)).toHaveLength(1);
    expect(after.find((member) => member.phone === phone)).toMatchObject({ paymentStatus: 'PARTIAL', groupIds: kind === 'GYM' ? [] : [data.group.id] });
    await page.goto('/members');
    await expect(page.getByRole('row').filter({ hasText: `Student ${suffix}` })).toBeVisible();
  });
}
test('a template matches the selected mixed variation and clears preview after choices change', async ({ page, request }) => {
  const suffix = String(Date.now()).slice(-8);
  const data = await catalog(request, suffix, 'MIXED', true);
  await configure(page, data, 'MIXED');
  const href = await page.getByRole('link', { name: 'Télécharger le modèle Excel adapté' }).getAttribute('href');
  const response = await request.get(href);
  expect(response.status()).toBe(200);
  expect((await readSheet(await response.body(), 1))[0]).toContain(`Restant ${data.sport.name}`);
  await upload(page, [['Prénom', 'Nom', 'Type membre', 'Téléphone', 'Séances restantes', 'Visites restantes'], ['Excel', 'Preview change', 'ADULT', `00${suffix}`, 3, 4]]);
  await page.getByRole('button', { name: 'Vérifier le fichier Excel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Importer 1 élèves', exact: true })).toBeEnabled();
  await page.getByRole('combobox', { name: 'Activité à importer', exact: true }).selectOption('GYM');
  await expect(page.getByRole('button', { name: 'Importer 0 élèves', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Formule par défaut', exact: true })).toHaveValue('');
});
test('an invalid Excel row prevents importing the whole file', async ({ page, request }) => {
  const suffix = String(Date.now()).slice(-8), data = await catalog(request, suffix, 'GYM');
  await configure(page, data, 'GYM');
  await upload(page, [['Prénom', 'Nom', 'Type membre', 'Téléphone', 'Date début', 'Déjà payé'], ['Valid', 'First', 'ADULT', `00${suffix}`, '2026-10-13', 20], ['Invalid', 'Second', 'ADULT', `01${suffix}`, '31/02/2026', 60]]);
  await page.getByLabel('Date de reprise', { exact: true }).fill('2026-10-13');
  await page.getByRole('button', { name: 'Vérifier le fichier Excel', exact: true }).click();
  await expect(page.getByText('1/2 lignes prêtes', { exact: false })).toBeVisible();
  await expect(page.getByText('Date début impossible', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importer 1 élèves', exact: true })).toBeDisabled();
});
test('recovery is visible in settings without exposing a file or shell API to a browser', async ({ page }) => {
  await page.goto('/settings/offline-data');
  await expect(page.getByRole('heading', { name: 'Sauvegarde et récupération', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByText("La récupération est disponible dans l'application Windows We Discipline.", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => typeof window.weDisciplineDesktop)).toBe('undefined');
});
test('uploaded club branding survives local service restart', async ({ request, runtime }) => {
  const bytes = await readFile(path.resolve('desktop/assets/we-discipline.png'));
  const response = await request.post('/api/club-settings/logo', { multipart: { logo: { name: 'test-logo.png', mimeType: 'image/png', buffer: bytes } } });
  expect(response.status(), await response.text()).toBe(200);
  const url = (await response.json()).data.clubLogoUrl;
  expect(url).toMatch(/^\/branding\/club-logo-/);
  expect((await (await request.get(url)).body()).equals(bytes)).toBe(true);
  await runtime.restart();
  expect((await (await request.get(url)).body()).equals(bytes)).toBe(true);
});
test.describe('Import administrative access', () => {
  test.use({ signedIn: false });
  test('an unauthenticated browser cannot import, read templates or enable local modules', async ({ request }) => {
    expect((await request.get('/api/data-import/students')).status()).toBe(401);
    expect((await request.post('/api/data-import/students', { data: {} })).status()).toBe(401);
    expect((await request.post('/api/offline/modules', { data: { moduleKey: 'GYM_ACCESS' } })).status()).toBe(401);
  });
});
