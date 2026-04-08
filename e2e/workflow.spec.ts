import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { generateFixture } from './fixtures/generateFixture';

const fixtureDir = path.join(process.cwd(), 'e2e', 'fixtures', 'generated-workflow');
const threePatientFixture = path.join(fixtureDir, 'patients-3.xlsx');
const twoPatientFixture = path.join(fixtureDir, 'patients-2.xlsx');
const onePatientFixture = path.join(fixtureDir, 'patients-1.xlsx');

async function prepareFixtures() {
  await generateFixture(threePatientFixture, [
    { firstName: 'Test Patient', lastName: 'One', mobile: '0411 111 111' },
    { firstName: 'Test Patient', lastName: 'Two', mobile: '0422 222 222' },
    { firstName: 'Test Patient', lastName: 'Three', mobile: '0433 333 333' },
  ]);
  await generateFixture(twoPatientFixture, [
    { firstName: 'Test Patient', lastName: 'One', mobile: '0411 111 111' },
    { firstName: 'Test Patient', lastName: 'Two', mobile: '0422 222 222' },
  ]);
  await generateFixture(onePatientFixture, [
    { firstName: 'Test Patient', lastName: 'Four', mobile: '0444 444 444' },
  ]);
}

test.beforeEach(async ({ page, context }) => {
  await prepareFixtures();
  await context.clearCookies();
  await page.goto('/upload');
  await page.evaluate(async () => {
    localStorage.clear();
    indexedDB.deleteDatabase('hughs-pharmacy-sms');
  });
  await page.goto('/upload');
});

test('full upload → select → send session → results workflow', async ({ page }) => {
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('upload-dropzone').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(threePatientFixture);

  await expect(page.getByTestId('upload-patient-row')).toHaveCount(3);
  await page.getByTestId('upload-continue-button').click();

  await page.getByTestId('review-select-all').click();
  await expect(page.getByTestId('review-selection-summary')).toContainText('Selected 3');
  await page.getByTestId('review-continue-button').click();

  await expect(page.getByTestId('message-template-textarea')).not.toHaveValue('');
  await expect(page.getByTestId('message-preview-card').first()).toContainText('Test Patient One');
  await page.getByTestId('message-start-sending').click();

  await page.getByTestId('send-compliance-label').click();
  await expect(page.getByTestId('send-progress-panel')).toHaveAttribute('data-compliance-acknowledged', 'true');
  await expect(page.getByTestId('send-queue-item')).toHaveCount(3);
  await expect(page.getByTestId('send-mark-sent-next')).toBeEnabled();

  await page.getByTestId('send-mark-sent-next').click();
  await expect(page.getByTestId('send-mark-sent-next')).toBeEnabled();
  await page.getByTestId('send-skip-button').click();
  await page.getByTestId('send-confirm-skip').click();
  await expect(page.getByTestId('send-mark-sent-next')).toBeEnabled();
  await page.getByTestId('send-mark-sent-next').click();

  await expect(page.getByText(/0 pending/i)).toBeVisible();
  await page.getByRole('button', { name: /View full results/i }).click();

  await expect(page.getByTestId('results-row')).toHaveCount(3);
  await expect(page.getByTestId('results-row').filter({ hasText: 'Sent' })).toHaveCount(2);
  await expect(page.getByTestId('results-row').filter({ hasText: 'Skipped' })).toHaveCount(1);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('results-download-csv').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('_summary.csv');
});

test('upload append into active session', async ({ page }) => {
  let fileChooserPromise = page.waitForEvent('filechooser');

  await page.getByTestId('upload-dropzone').click();
  let fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(twoPatientFixture);
  await page.getByTestId('upload-continue-button').click();
  await page.getByTestId('review-select-all').click();
  await page.getByTestId('review-continue-button').click();
  await expect(page).toHaveURL(/\/message$/);
  await page.getByTestId('message-start-sending').click();
  await expect(page).toHaveURL(/\/send$/);

  await page.getByTestId('send-compliance-label').click();
  await expect(page.getByTestId('send-progress-panel')).toHaveAttribute('data-compliance-acknowledged', 'true');
  await expect(page.getByTestId('send-current-patient')).toBeVisible();
  await expect(page.getByTestId('send-queue-item')).toHaveCount(2);

  await page.goto('/upload');
  fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('upload-dropzone').click();
  fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(onePatientFixture);

  await expect(page).toHaveURL(/\/send$/);
  await expect(page.getByTestId('send-queue-item')).toHaveCount(3);
  await expect(page.getByTestId('send-queue-panel')).toContainText('Test Patient One');
  await expect(page.getByTestId('send-queue-panel')).toContainText('Test Patient Two');
  await expect(page.getByTestId('send-queue-panel')).toContainText('Test Patient Four');
});

test.afterAll(async () => {
  await fs.rm(fixtureDir, { recursive: true, force: true });
});
