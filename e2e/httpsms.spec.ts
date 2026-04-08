import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { generateFixture } from './fixtures/generateFixture';

const fixtureDir = path.join(process.cwd(), 'e2e', 'fixtures', 'generated-httpsms');
const smsFixture = path.join(fixtureDir, 'patients-sms.xlsx');

async function prepareFixture() {
  await generateFixture(smsFixture, [
    { firstName: 'Test Patient', lastName: 'One', mobile: '0411 111 111' },
  ]);
}

async function loadSendPage(page: import('@playwright/test').Page, withConfig = true) {
  await prepareFixture();
  await page.goto('/upload');
  await page.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('hughs-pharmacy-sms');
  });

  if (withConfig) {
    await page.addInitScript(() => {
      localStorage.setItem('httpsms_api_key', 'test-api-key-abc');
      localStorage.setItem('httpsms_from_number', '+61400000000');
    });
  }

  await page.goto('/upload');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('upload-dropzone').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(smsFixture);
  await page.getByTestId('upload-continue-button').click();
  await page.getByTestId('review-select-all').click();
  await page.getByTestId('review-continue-button').click();
  await page.getByTestId('message-start-sending').click();

  const compliance = page.getByTestId('send-compliance-checkbox');
  if (await compliance.isVisible()) {
    await compliance.click();
  }
}

test.beforeEach(async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/upload');
});

test('Send SMS succeeds with valid configuration', async ({ page }) => {
  let requestBody: any = null;

  await page.route('https://api.httpsms.com/v1/messages/send', async (route) => {
    requestBody = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'accepted', data: { id: 'mock-id-001', status: 'pending' } }),
    });
  });

  await loadSendPage(page, true);
  await page.getByTestId('send-patient-phone-input').fill('0411 111 111');
  await page.getByTestId('send-sms-button').click();

  await expect(page.getByTestId('send-sms-button')).toContainText(/Sent!/i);
  expect(requestBody.from).toBe('+61400000000');
  expect(requestBody.to).toBe('+61411111111');
  expect(requestBody.content).toContain('Hello Test');
});

test('Send SMS shows correct error for invalid API key (401)', async ({ page }) => {
  await page.route('https://api.httpsms.com/v1/messages/send', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });

  await loadSendPage(page, true);
  await page.getByTestId('send-patient-phone-input').fill('0411 111 111');
  await page.getByTestId('send-sms-button').click();
  await expect(page.getByTestId('toast-description').filter({ hasText: 'Invalid API key — check Settings' })).toBeVisible();
});

test('Send SMS shows correct error for invalid phone number (422)', async ({ page }) => {
  await page.route('https://api.httpsms.com/v1/messages/send', async (route) => {
    await route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid phone number' }),
    });
  });

  await loadSendPage(page, true);
  await page.getByTestId('send-patient-phone-input').fill('0411 111 111');
  await page.getByTestId('send-sms-button').click();
  await expect(page.getByTestId('toast-description').filter({ hasText: 'Invalid phone number or message format' })).toBeVisible();
});

test('Send SMS button is disabled when httpSMS not configured', async ({ page }) => {
  await loadSendPage(page, false);
  await expect(page.getByTestId('send-sms-button')).toBeDisabled();
  await expect(page.getByTestId('send-sms-button')).toHaveAttribute('title', /Configure httpSMS in Settings first/i);
});

test('Settings panel saves and persists API key and from-number', async ({ page }) => {
  await page.goto('/settings');
  await page.getByTestId('settings-toggle-api-key').click();
  await page.getByTestId('settings-api-key-input').fill('my-test-key-xyz');
  await page.getByTestId('settings-from-number-input').fill('0412 345 678');
  await page.getByTestId('settings-from-number-input').blur();
  await page.reload();
  await page.goto('/settings');
  await page.getByTestId('settings-toggle-api-key').click();
  await expect(page.getByTestId('settings-api-key-input')).toHaveValue('my-test-key-xyz');
  await expect(page.getByTestId('settings-from-number-input')).toHaveValue(/0412 345 678|\+61412345678/);
});

test.afterAll(async () => {
  await fs.rm(fixtureDir, { recursive: true, force: true });
});
