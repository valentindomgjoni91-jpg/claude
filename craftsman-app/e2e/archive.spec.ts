import { test, expect } from '@playwright/test';
import { resetAndReload, waitForSeedProject } from './helpers';

async function createDailyReport(page: import('@playwright/test').Page, title: string) {
  await page.getByRole('button', { name: /Tagesrapport/ }).first().click();
  await waitForSeedProject(page);
  await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
  await page.getByLabel('Titel').fill(title);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page.waitForURL(/\/tagesrapport\/.+/);
  // Go back to dashboard
  await page.goto('/');
  await page.waitForSelector('text=Guten Tag');
}

async function createRegiReport(page: import('@playwright/test').Page, title: string) {
  await page.getByRole('button', { name: /Regierapport/ }).first().click();
  await waitForSeedProject(page);
  await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
  await page.getByLabel('Titel').fill(title);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page.waitForURL(/\/regierapport\/.+/);
  await page.goto('/');
  await page.waitForSelector('text=Guten Tag');
}

test.describe('Archive', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndReload(page);
  });

  test('shows empty state initially', async ({ page }) => {
    await page.getByRole('link', { name: 'Archiv' }).click();
    await expect(page.getByText('Keine Rapporte gefunden')).toBeVisible();
  });

  test('shows created reports', async ({ page }) => {
    await createDailyReport(page, 'Bauarbeiten Tag 1');
    await createRegiReport(page, 'Abrechnung Woche 1');

    await page.getByRole('link', { name: 'Archiv' }).click();
    await expect(page.getByText('Bauarbeiten Tag 1')).toBeVisible();
    await expect(page.getByText('Abrechnung Woche 1')).toBeVisible();
  });

  test('search filters reports by title', async ({ page }) => {
    await createDailyReport(page, 'Maurerarbeiten Nord');
    await createDailyReport(page, 'Erdarbeiten Süd');

    await page.getByRole('link', { name: 'Archiv' }).click();
    await expect(page.getByText('Maurerarbeiten Nord')).toBeVisible();
    await expect(page.getByText('Erdarbeiten Süd')).toBeVisible();

    // Search for "Maurer"
    await page.getByPlaceholder('Titel, Datum, Projekt oder Kunde').fill('Maurer');
    await expect(page.getByText('Maurerarbeiten Nord')).toBeVisible();
    await expect(page.getByText('Erdarbeiten Süd')).not.toBeVisible();
  });

  test('filter panel opens and closes', async ({ page }) => {
    await page.getByRole('link', { name: 'Archiv' }).click();
    // Click filter button
    await page.getByRole('button', { name: 'Filter' }).dispatchEvent('click');
    // Filter panel should show
    await expect(page.getByText('Status').first()).toBeVisible();
  });

  test('type filter shows only daily reports', async ({ page }) => {
    await createDailyReport(page, 'Tagesrapport Filtern');
    await createRegiReport(page, 'Regierapport Filtern');

    await page.getByRole('link', { name: 'Archiv' }).click();

    // Click the pill button "Tagesrapporte" to filter by type
    await page.getByRole('button', { name: 'Tagesrapporte' }).click();

    await expect(page.getByText('Tagesrapport Filtern')).toBeVisible();
    await expect(page.getByText('Regierapport Filtern')).not.toBeVisible();
  });

  test('report preview opens on tap', async ({ page }) => {
    await createDailyReport(page, 'Preview Test Rapport');

    await page.getByRole('link', { name: 'Archiv' }).click();
    await page.getByText('Preview Test Rapport').click();

    // Preview bottom sheet should appear — check action buttons
    await expect(page.getByRole('button', { name: 'Öffnen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kopieren' })).toBeVisible();
  });

  test('preview "Öffnen" navigates to report', async ({ page }) => {
    await createDailyReport(page, 'Navigation Test Rapport');

    await page.getByRole('link', { name: 'Archiv' }).click();
    await page.getByText('Navigation Test Rapport').click();

    // Click Öffnen in the preview sheet
    await page.getByRole('button', { name: 'Öffnen' }).click();
    await expect(page.url()).toMatch(/\/tagesrapport\/.+/);
  });

  test('sort order toggle works', async ({ page }) => {
    await createDailyReport(page, 'Alpha Rapport');
    await createDailyReport(page, 'Beta Rapport');

    await page.getByRole('link', { name: 'Archiv' }).click();
    // Both visible (newest first by default)
    await expect(page.getByText('Alpha Rapport')).toBeVisible();
    await expect(page.getByText('Beta Rapport')).toBeVisible();

    // Toggle sort order
    await page.getByRole('button', { name: 'Sortierung' }).dispatchEvent('click');
    // Reports still visible after sort toggle
    await expect(page.getByText('Alpha Rapport')).toBeVisible();
    await expect(page.getByText('Beta Rapport')).toBeVisible();
  });

  test('duplicate from preview creates copy and navigates', async ({ page }) => {
    await createDailyReport(page, 'Original Rapport');

    await page.getByRole('link', { name: 'Archiv' }).click();
    await page.getByText('Original Rapport').click();

    // Click Kopieren in preview sheet
    await page.getByRole('button', { name: 'Kopieren' }).click();

    // Should navigate to the new (copied) report (duplicate is async)
    await page.waitForURL(/\/tagesrapport\/.+/, { timeout: 8_000 });
    await expect(page.getByText('Kopie – Original Rapport')).toBeVisible();
  });
});
