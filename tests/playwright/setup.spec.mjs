import { test, expect, credentials, login } from './fixtures.mjs';

test.use({ accountMode: 'fresh', signedIn: false });

test('first administrator setup works once, then duplicate setup is rejected', async ({ page, request }) => {
  await page.goto('/offline-setup');
  await page.getByLabel('Nom du club').fill('Playwright test club');
  await page.getByLabel('Votre nom').fill(credentials.name);
  await page.getByLabel('Email de connexion').fill(credentials.email);
  await page.getByLabel('Mot de passe').fill(credentials.password);
  const setup = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/offline/setup');
  await page.getByRole('button', { name: 'Créer mon espace local' }).click();
  expect((await setup).status()).toBe(201);
  await expect(page).toHaveURL(/\/login$/);
  expect((await login(page)).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/login/);
  expect((await request.post('/api/offline/setup', { data: { ...credentials, clubName: 'Duplicate club' } })).status()).toBe(409);
});
