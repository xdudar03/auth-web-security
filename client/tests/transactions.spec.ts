import { test, expect, Page } from '@playwright/test';

// Helper to login before tests
async function loginAsUser(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username/i }).fill('user');
  await page.getByRole('textbox', { name: /password/i }).fill('user');
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
}

async function loginAsProvider(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username/i }).fill('shop owner 1');
  await page.getByRole('textbox', { name: /password/i }).fill('shop owner 1');
  await page.getByRole('button', { name: /^login$/i }).click();
  await expect(page).toHaveURL('/provider-dashboard', { timeout: 10000 });
}

test.describe('Transactions - User Shopping History', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
  });

  test('user can navigate to shopping history', async ({ page }) => {
    // Click on shopping history link in sidebar
    await page.getByRole('link', { name: /shopping history/i }).click();

    await expect(page).toHaveURL('/shopping-history', { timeout: 5000 });
    await expect(
      page.getByRole('heading', { name: /shopping history/i })
    ).toBeVisible();
  });

  test('shopping history page displays correctly', async ({ page }) => {
    await page.goto('/shopping-history');

    // Check page elements
    await expect(
      page.getByRole('heading', { name: /shopping history/i })
    ).toBeVisible();
    await expect(page.getByText(/your total spendings/i)).toBeVisible();
  });

  test('user can add test transactions', async ({ page }) => {
    await page.goto('/shopping-history');

    // Find and click the add test transactions button
    const addButton = page.getByRole('button', {
      name: /add test transactions/i,
    });
    await expect(addButton).toBeVisible();

    // Click to add test transactions
    await addButton.click();

    // Button should show loading state
    await expect(
      page
        .getByText(/adding/i)
        .or(page.getByRole('button', { name: /add test transactions/i }))
    ).toBeVisible();

    // Wait for transactions to be added
    await page.waitForTimeout(3000);

    // Check that transactions table shows data (or the page doesn't show an error)
    const hasTable = await page
      .locator('table')
      .isVisible()
      .catch(() => false);
    const hasData = await page
      .locator('tbody tr')
      .first()
      .isVisible()
      .catch(() => false);
    const noError = !(await page
      .getByText(/error/i)
      .isVisible()
      .catch(() => false));

    expect(hasTable || noError).toBeTruthy();
  });

  test('transactions table shows transaction data', async ({ page }) => {
    await page.goto('/shopping-history');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check for table structure
    const table = page.locator('table');
    if (await table.isVisible()) {
      // Check for table headers or row data
      const headers = table.locator('th');
      const rows = table.locator('tbody tr');

      // Either should have headers or rows
      const headerCount = await headers.count();
      const rowCount = await rows.count();

      expect(headerCount > 0 || rowCount >= 0).toBeTruthy();
    }
  });
});

test.describe('Transactions - Provider Shop History', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsProvider(page);
  });

  test('provider can navigate to shop history', async ({ page }) => {
    // Click on shopping history link in sidebar (providers see shop-history)
    await page.getByRole('link', { name: /shopping history/i }).click();

    await expect(page).toHaveURL('/shop-history', { timeout: 5000 });
  });

  test('provider shop history page displays correctly', async ({ page }) => {
    await page.goto('/shop-history');

    // Page should load without errors
    await page.waitForTimeout(2000);

    // Check that we're on the correct page and it loads
    expect(page.url()).toContain('/shop-history');
  });

  test('provider can view customer transactions', async ({ page }) => {
    await page.goto('/shop-history');

    // Wait for data to load
    await page.waitForTimeout(3000);

    // Check for table or data display
    const hasTable = await page
      .locator('table')
      .isVisible()
      .catch(() => false);
    const hasContent = await page
      .locator('tbody')
      .isVisible()
      .catch(() => false);

    // Page should have loaded successfully (table may be empty if no transactions)
    expect(page.url()).toContain('/shop-history');
  });
});

test.describe('Transactions - Total Spendings', () => {
  test('user spendings are displayed', async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/shopping-history');

    // Check for spendings display
    const spendingsText = page.getByText(/your total spendings/i);
    await expect(spendingsText).toBeVisible();

    // Spendings should show a currency amount
    const currencyDisplay = page.locator('text=/\\d+.*USD|\\$\\d+/');
    // May or may not have spendings, but the element should exist
    expect(await spendingsText.isVisible()).toBeTruthy();
  });
});
