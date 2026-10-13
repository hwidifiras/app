import { test, expect, credentials, login, createPaidMember } from './fixtures.mjs';

test.describe('Local authentication', () => {
  test.use({ signedIn: false });
  test('protected pages require login', async ({ page }) => {
    await page.goto('/members');
    await expect(page).toHaveURL(/\/login\?/);
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  });
  test('incorrect credentials are rejected in the login form', async ({ page }) => {
    const response = await login(page, 'Incorrect-test-password');
    expect(response.status()).toBe(401);
    await expect(page.getByText('Identifiants invalides', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
  test('the provisioned administrator can log in', async ({ page }) => {
    expect((await login(page)).status()).toBe(200);
    await expect(page).not.toHaveURL(/\/login/);
    const account = await page.evaluate(() => fetch('/api/account').then((response) => response.json()));
    expect(account.data).toMatchObject({ email: credentials.email, role: 'ADMIN', operationsAllowed: true });
  });
});

test('logout clears access to protected pages', async ({ page }) => {
  await page.goto('/members');
  expect(await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }).then((response) => response.status))).toBe(200);
  await page.reload();
  await expect(page).toHaveURL(/\/login\?/);
});

test('locked profiles hide the new-account form', async ({ page }) => {
  await page.goto('/settings/users');
  await expect(page.getByRole('heading', { name: 'Utilisateurs', exact: true })).toBeVisible();
  await expect(page.locator('#user-create')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ajouter un utilisateur' })).toHaveCount(0);
  await expect(page.getByText('La création de nouveaux comptes est désactivée.', { exact: false })).toBeVisible();
});

test('even an administrator cannot create another account', async ({ request }) => {
  const before = (await (await request.get('/api/users')).json()).data;
  for (const route of ['/api/users', '/api/offline/setup']) {
    const response = await request.post(route, { data: { email: 'unwanted@example.test', password: credentials.password, name: 'Unwanted account', clubName: 'Other club', role: 'ADMIN' } });
    expect(response.status()).toBe(403);
  }
  const after = (await (await request.get('/api/users')).json()).data;
  expect(after.map((user) => user.id).sort()).toEqual(before.map((user) => user.id).sort());
});

test('setup and registration pages redirect to login on a locked profile', async ({ page }) => {
  for (const route of ['/offline-setup', '/register']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test('the private application header is required', async ({ runtime }) => {
  const response = await fetch(`${runtime.origin}/api/ready`);
  expect(response.status).toBe(403);
});

test('cross-origin writes and cloud registration are rejected', async ({ request }) => {
  const crossOrigin = await request.post('/api/users', { headers: { Origin: 'https://external.example.test' }, data: {} });
  expect(crossOrigin.status()).toBe(403);
  expect((await crossOrigin.json()).error).toBe('Origine non autorisée');
  expect((await request.post('/api/auth/register', { data: {} })).status()).toBe(404);
});

for (const route of ['/enrollment', '/members', '/payments', '/sessions', '/groups', '/coaches', '/gym/check-in', '/gym/visits', '/plans', '/offers', '/settings/club']) {
  test(`offline screen renders: ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${route === '/plans' ? '/subscription-plans' : route}$`));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Application error|Gestion des membres indisponible/);
  });
}

test('paid enrollment appears in the member directory and local ledger', async ({ page, request }) => {
  const member = await createPaidMember(request, '100001');
  await page.goto('/members');
  await page.getByPlaceholder('Nom, téléphone ou email...').fill(member.lastName);
  const row = page.getByRole('row').filter({ hasText: member.lastName });
  await expect(row).toBeVisible();
  await row.getByRole('link').first().click();
  await expect(page).toHaveURL(new RegExp(`/members/${member.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(member.lastName);
  const response = await request.get(`/api/payments?memberId=${member.id}`);
  expect(response.status()).toBe(200);
  const payments = (await response.json()).data;
  expect(payments).toHaveLength(1);
  expect(payments[0]).toMatchObject({ amount: 5000, memberSubscription: { member: { id: member.id } } });
  expect(payments[0].receipt?.receiptNumber).toBeTruthy();
});

test('members and account restrictions survive a complete local restart', async ({ page, request, runtime }) => {
  const member = await createPaidMember(request, '100002');
  await page.goto('/members');
  await runtime.restart();
  await page.reload();
  await page.getByPlaceholder('Nom, téléphone ou email...').fill(member.lastName);
  await expect(page.getByRole('row').filter({ hasText: member.lastName })).toBeVisible();
  expect((await request.post('/api/users', { data: {} })).status()).toBe(403);
  await page.goto('/settings/users');
  await expect(page.locator('#user-create')).toHaveCount(0);
});

