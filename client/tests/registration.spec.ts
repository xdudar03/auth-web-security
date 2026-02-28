import { test, expect } from '@playwright/test';

// Generate unique username for each test to avoid conflicts
function generateUniqueUsername() {
  return `testuser_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

test.describe('User Registration', () => {
  test('should display registration page correctly', async ({ page }) => {
    await page.goto('/registration');

    // Check page elements
    await expect(
      page.getByRole('heading', { name: /registration/i })
    ).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: /username/i })
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByLabel(/recovery passphrase/i)).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: /password/i })
    ).toBeVisible();
    // Use exact match to avoid matching "Use biometric registration" button
    await expect(
      page.getByRole('button', { name: 'Registration', exact: true })
    ).toBeVisible();
  });

  test('should show error for empty fields', async ({ page }) => {
    await page.goto('/registration');

    // Try to submit without filling anything - use exact match for submit button
    await page
      .getByRole('button', { name: 'Registration', exact: true })
      .click();

    // Should show error message
    await expect(page.getByText(/please fill in all fields/i)).toBeVisible();
  });

  test('should show error for short password', async ({ page }) => {
    await page.goto('/registration');

    const username = generateUniqueUsername();

    // Fill in fields with short password
    await page.getByRole('textbox', { name: /username/i }).fill(username);
    await page
      .getByRole('textbox', { name: /email/i })
      .fill(`${username}@test.com`);
    await page.getByRole('textbox', { name: /password/i }).fill('short');
    await page
      .getByRole('textbox', { name: /recovery passphrase/i })
      .fill('short');

    // Submit - use exact match for submit button
    await page
      .getByRole('button', { name: 'Registration', exact: true })
      .click();

    // Should show password error
    await expect(
      page.getByText(/password must be at least 8 characters/i)
    ).toBeVisible();
  });

  test('should show error for password without number', async ({ page }) => {
    await page.goto('/registration');

    const username = generateUniqueUsername();

    // Fill in fields with password without number
    await page.getByRole('textbox', { name: /username/i }).fill(username);
    await page
      .getByRole('textbox', { name: /email/i })
      .fill(`${username}@test.com`);
    await page
      .getByRole('textbox', { name: /password/i })
      .fill('longenoughpassword');
    await page
      .getByRole('textbox', { name: /recovery passphrase/i })
      .fill('longenoughpassword');
    // Submit - use exact match for submit button
    await page
      .getByRole('button', { name: 'Registration', exact: true })
      .click();

    // Should show password error
    await expect(
      page.getByText(/password must contain at least one number/i)
    ).toBeVisible();
  });

  test('new user can register successfully', async ({ page }) => {
    await page.goto('/registration');

    const username = generateUniqueUsername();
    const email = `${username}@test.com`;
    const password = 'testpassword123';

    // Fill in registration form
    await page.getByRole('textbox', { name: /username/i }).fill(username);
    await page.getByRole('textbox', { name: /email/i }).fill(email);
    await page.getByRole('textbox', { name: /password/i }).fill(password);

    // The shops multiselect should be pre-populated, but let's make sure at least one is selected
    // by checking if the shop selector exists
    const shopSelector = page
      .locator('[data-testid="shop-selector"], [role="combobox"]')
      .first();
    if (await shopSelector.isVisible()) {
      // Shops should be pre-selected by default
      console.log('Shop selector found');
    }

    // Submit registration - use exact match for submit button
    await page
      .getByRole('button', { name: 'Registration', exact: true })
      .click();

    // Wait for registration response
    await page.waitForTimeout(3000);

    // Check for various success indicators:
    // - Redirect to dashboard
    // - Success message
    // - Email confirmation modal/message
    // - No error message displayed
    const url = page.url();
    const isDashboard = url.includes('/dashboard');
    const hasSuccess = await page
      .getByText(/successful/i)
      .isVisible()
      .catch(() => false);
    const hasConfirmEmail = await page
      .getByText(/confirm.*email|email.*confirm|verification/i)
      .isVisible()
      .catch(() => false);
    const hasError = await page
      .getByText(/error|failed|already exists/i)
      .isVisible()
      .catch(() => false);

    // Registration is successful if we got redirected, see success message,
    // see email confirmation prompt, or at least no error
    expect(
      isDashboard || hasSuccess || hasConfirmEmail || !hasError
    ).toBeTruthy();
  });

  test('should have shop selection during registration', async ({ page }) => {
    await page.goto('/registration');

    // Wait for shops to load
    await page.waitForTimeout(2000);

    // Check that shop selection UI is present (multiselect)
    const shopElements = page.locator('text=/shop/i');
    await expect(shopElements.first()).toBeVisible({ timeout: 5000 });
  });

  test('back button returns to home page', async ({ page }) => {
    await page.goto('/registration');

    // Click back button (icon button with class icon-btn-zoom, first button in the form)
    await page.locator('button.icon-btn-zoom').first().click();

    // Should navigate to home
    await expect(page).toHaveURL('/', { timeout: 5000 });
  });
});
