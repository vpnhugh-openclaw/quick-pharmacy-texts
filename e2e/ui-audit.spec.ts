import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { generateFixture } from './fixtures/generateFixture';

const fixtureDir = path.join(process.cwd(), 'e2e', 'fixtures', 'generated-audit');
const fixturePath = path.join(fixtureDir, 'patients-audit.xlsx');

async function prepareFixture() {
  await generateFixture(fixturePath, [
    { firstName: 'Audit', lastName: 'One', mobile: '0411 111 111' },
    { firstName: 'Audit', lastName: 'Two', mobile: '0422 222 222' },
    { firstName: 'Audit', lastName: 'Three', mobile: '0433 333 333' },
  ]);
}

test.beforeEach(async ({ page, context }) => {
  await prepareFixture();
  await context.clearCookies();
  await page.goto('/upload');
  await page.evaluate(async () => {
    localStorage.clear();
    indexedDB.deleteDatabase('hughs-pharmacy-sms');
  });
  await page.goto('/upload');
});

test('audit main interactive controls and clear queue behaviour', async ({ page }) => {
  await expect(page.getByText(/Set up direct sending in 3 steps/i)).toBeVisible();
  await page.getByRole('button', { name: /Dismiss setup guide banner/i }).click();
  await expect(page.getByText(/Set up direct sending in 3 steps/i)).toHaveCount(0);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('upload-dropzone').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(fixturePath);

  await page.getByTestId('upload-continue-button').click();
  await page.getByTestId('review-select-all').click();
  await page.getByTestId('review-continue-button').click();
  await page.getByTestId('message-start-sending').click();
  await page.getByTestId('send-compliance-label').click();

  await expect(page.getByTestId('send-copy-number')).toBeVisible();
  await expect(page.getByTestId('send-copy-message')).toBeVisible();
  await expect(page.getByTestId('send-sms-button')).toBeDisabled();

  page.on('dialog', (dialog) => dialog.accept());

  await page.getByTestId('send-skip-button').click();
  await page.getByTestId('send-confirm-skip').click();
  await expect(page.getByTestId('send-queue-item')).toHaveCount(3);

  await page.getByTestId('send-queue-filter').selectOption('skipped');
  await expect(page.getByTestId('send-queue-item')).toHaveCount(1);
  await page.getByTestId('send-clear-queue').click();
  await expect(page.getByTestId('send-queue-item')).toHaveCount(0);

  await page.getByTestId('send-queue-filter').selectOption('all');
  await expect(page.getByTestId('send-queue-item')).toHaveCount(2);

  await page.getByTestId('send-view-summary').click();
  await expect(page.getByRole('heading', { name: /Session snapshot|Session complete/i })).toBeVisible();
  await page.getByRole('button', { name: /Return to session/i }).click();
  await expect(page.getByTestId('send-current-patient')).toBeVisible();

  await page.getByTestId('send-pause-save').click();
  await expect(page).toHaveURL(/\/upload$/);
  await page.getByRole('button', { name: /Resume session/i }).click();
  await expect(page).toHaveURL(/\/send$/);
});

test.afterAll(async () => {
  await fs.rm(fixtureDir, { recursive: true, force: true });
});
