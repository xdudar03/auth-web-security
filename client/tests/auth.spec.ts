import { test, expect, Page } from '@playwright/test';

// Test accounts from TestAccountsDialog.tsx
const testAccounts = {
  admin: {
    username: 'admin',
    password: 'admin',
    dashboard: '/admin-dashboard',
  },
  user: { username: 'user', password: 'user', dashboard: '/dashboard' },
  provider1: {
    username: 'shop owner 1',
    password: 'shop owner 1',
    dashboard: '/provider-dashboard',
  },
  provider2: {
    username: 'shop owner 2',
    password: 'shop owner 2',
    dashboard: '/provider-dashboard',
  },
  provider3: {
    username: 'shop owner 3',
    password: 'shop owner 3',
    dashboard: '/provider-dashboard',
  },
  hiddenAll: {
    username: 'hidden_all',
    password: 'password1',
    dashboard: '/dashboard',
  },
  anonAll: {
    username: 'anon_all',
    password: 'password2',
    dashboard: '/dashboard',
  },
  visibleAll: {
    username: 'visible_all',
    password: 'password3',
    dashboard: '/dashboard',
  },
  mixedA: {
    username: 'mixed_a',
    password: 'password4',
    dashboard: '/dashboard',
  },
};

async function login(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username/i }).fill(username);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /^login$/i }).click();
}

test.describe('Authentication - Login', () => {
  test('should display login page correctly', async ({ page }) => {
    await page.goto('/login');

    // Check page elements
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: /username/i })
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: /password/i })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible();
  });

  test('should show error for empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /^login$/i }).click();

    // Should show error message
    await expect(page.getByText(/please fill in all fields/i)).toBeVisible();
  });

  test('admin login redirects to admin dashboard', async ({ page }) => {
    const account = testAccounts.admin;
    await login(page, account.username, account.password);

    // Wait for redirect
    await expect(page).toHaveURL(account.dashboard, { timeout: 10000 });
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
  });

  test('regular user login redirects to user dashboard', async ({ page }) => {
    const account = testAccounts.user;
    await login(page, account.username, account.password);

    // Wait for redirect
    await expect(page).toHaveURL(account.dashboard, { timeout: 10000 });
  });

  test('provider login redirects to provider dashboard', async ({ page }) => {
    const account = testAccounts.provider1;
    await login(page, account.username, account.password);

    // Wait for redirect
    await expect(page).toHaveURL(account.dashboard, { timeout: 10000 });
  });

  test('should have test accounts dialog on login page', async ({ page }) => {
    await page.goto('/login');

    // Click on test accounts button
    await page.getByRole('button', { name: /use test account/i }).click();

    // Check dialog is visible
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/select a test account/i)).toBeVisible();

    // Check test account buttons are visible
    await expect(page.getByRole('button', { name: /^admin$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^user$/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /provider 1/i })
    ).toBeVisible();
  });

  test('login via test account dialog works', async ({ page }) => {
    await page.goto('/login');

    // Open test accounts dialog
    await page.getByRole('button', { name: /use test account/i }).click();

    // Click on User account
    await page.getByRole('button', { name: /^user$/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });
});

test.describe('Authentication - All User Types', () => {
  for (const [accountName, account] of Object.entries(testAccounts)) {
    test(`${accountName} can login successfully`, async ({ page }) => {
      await login(page, account.username, account.password);

      // Wait for redirect to appropriate dashboard
      await expect(page).toHaveURL(account.dashboard, { timeout: 10000 });
    });
  }
});

test.describe('Authentication - Logout', () => {
  test('user can logout successfully', async ({ page }) => {
    const account = testAccounts.user;
    await login(page, account.username, account.password);

    // Wait for redirect
    await expect(page).toHaveURL(account.dashboard, { timeout: 10000 });

    // Click logout button
    await page.getByRole('button', { name: /logout/i }).click();

    // Should be redirected to login page
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});

test.describe('Authentication - Protected Routes', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage to ensure no JWT persists from previous tests
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('unauthenticated user cannot access dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Should either redirect to login or show redirecting message
    await expect(async () => {
      const url = page.url();
      const isOnLogin = url.includes('/login');
      const showsRedirect = await page
        .getByText(/redirecting to login/i)
        .isVisible()
        .catch(() => false);
      const showsLoading = await page
        .getByText(/loading/i)
        .isVisible()
        .catch(() => false);
      expect(isOnLogin || showsRedirect || showsLoading).toBeTruthy();
    }).toPass({ timeout: 15000 });
  });

  test('unauthenticated user cannot access account page', async ({ page }) => {
    await page.goto('/account');

    // Should either redirect to login or show redirecting message
    await expect(async () => {
      const url = page.url();
      const isOnLogin = url.includes('/login');
      const showsRedirect = await page
        .getByText(/redirecting to login/i)
        .isVisible()
        .catch(() => false);
      const showsLoading = await page
        .getByText(/loading/i)
        .isVisible()
        .catch(() => false);
      expect(isOnLogin || showsRedirect || showsLoading).toBeTruthy();
    }).toPass({ timeout: 15000 });
  });

  test('unauthenticated user cannot access settings page', async ({ page }) => {
    await page.goto('/settings');

    // Should either redirect to login or show redirecting message
    await expect(async () => {
      const url = page.url();
      const isOnLogin = url.includes('/login');
      const showsRedirect = await page
        .getByText(/redirecting to login/i)
        .isVisible()
        .catch(() => false);
      const showsLoading = await page
        .getByText(/loading/i)
        .isVisible()
        .catch(() => false);
      expect(isOnLogin || showsRedirect || showsLoading).toBeTruthy();
    }).toPass({ timeout: 15000 });
  });
});
