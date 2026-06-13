import { test, expect, type Page } from '@playwright/test';
import { resetAndReload, waitForSeedProject } from './helpers';

/** Dispatch click directly on an element to bypass sticky-header overlap. */
async function clickTab(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).first().dispatchEvent('click');
  await page.waitForTimeout(150);
}

/** Click the "save" button inside the currently visible add-form (not the header save). */
async function saveFormEntry(page: Page) {
  // The add-form has `border-2 border-primary-200`; click its Speichern button
  await page.locator('div.border-2.border-primary-200').getByRole('button', { name: 'Speichern' }).click();
}

test.describe('Daily report flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndReload(page);
  });

  test('creates a new daily report from dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /Tagesrapport/ }).first().click();
    await expect(page.getByText('Neuer Tagesrapport')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Info' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Zeiten/ })).toBeVisible();
  });

  test('selects project and saves info tab', async ({ page }) => {
    await page.getByRole('button', { name: /Tagesrapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    expect(await page.getByLabel('Projekt *').inputValue()).not.toBe('');
    await page.getByLabel('Titel').fill('E2E Tagesrapport Test');

    // Header save button
    await page.getByRole('button', { name: 'Speichern' }).first().click();
    await page.waitForURL(/\/tagesrapport\/.+/);
    await expect(page.getByText('E2E Tagesrapport Test')).toBeVisible();
  });

  test('adds a time entry', async ({ page }) => {
    await page.getByRole('button', { name: /Tagesrapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByRole('button', { name: 'Speichern' }).first().click();
    await page.waitForURL(/\/tagesrapport\/.+/);

    // Switch to Zeiten tab
    await clickTab(page, /Zeiten/);
    await expect(page.getByRole('button', { name: 'Zeiteintrag hinzufügen' })).toBeVisible();
    await page.getByRole('button', { name: 'Zeiteintrag hinzufügen' }).click();
    await expect(page.getByText('Neuer Zeiteintrag')).toBeVisible();

    // Wait for employees to load into the Mitarbeiter select (seed data is async)
    await page.waitForFunction(() => {
      const sel = document.getElementById('mitarbeiter') as HTMLSelectElement | null;
      return sel !== null && sel.options.length > 1;
    }, undefined, { timeout: 10_000 });

    // Select the first available employee
    await page.getByLabel('Mitarbeiter').selectOption({ index: 1 });
    await page.getByLabel('Von').fill('07:00');
    await page.getByLabel('Bis').fill('16:30');
    await page.getByLabel('Pause (min)').fill('30');
    await page.getByLabel('Tätigkeit').fill('Schalung');

    await saveFormEntry(page);
    await expect(page.getByText('Total Arbeitsstunden')).toBeVisible();
    await expect(page.getByText('9h').first()).toBeVisible();
  });

  test('adds a material entry', async ({ page }) => {
    await page.getByRole('button', { name: /Tagesrapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByRole('button', { name: 'Speichern' }).first().click();
    await page.waitForURL(/\/tagesrapport\/.+/);

    // Switch to Material tab
    await clickTab(page, /^Material/);
    await expect(page.getByRole('button', { name: 'Material hinzufügen' })).toBeVisible();
    await page.getByRole('button', { name: 'Material hinzufügen' }).click();

    await page.getByLabel('Bezeichnung *').fill('Beton C25/30');
    await page.getByLabel('Menge').fill('5');
    await page.getByLabel('EP (CHF)').fill('180');

    await saveFormEntry(page);
    await expect(page.getByText(/CHF.900/)).toBeVisible();
  });

  test('completes a daily report', async ({ page }) => {
    await page.getByRole('button', { name: /Tagesrapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByRole('button', { name: 'Speichern' }).first().click();
    await page.waitForURL(/\/tagesrapport\/.+/);

    await page.getByRole('button', { name: 'Rapport abschliessen' }).click();
    await expect(page.getByText('Rapport abgeschlossen')).toBeVisible();
  });

  test('completed report appears in archive', async ({ page }) => {
    await page.getByRole('button', { name: /Tagesrapport/ }).first().click();
    await waitForSeedProject(page);
    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByLabel('Titel').fill('Archiv Test Tagesrapport');
    await page.getByRole('button', { name: 'Speichern' }).first().click();
    await page.waitForURL(/\/tagesrapport\/.+/);
    await page.getByRole('button', { name: 'Rapport abschliessen' }).click();

    await page.getByRole('link', { name: 'Archiv' }).click();
    await expect(page.getByText('Archiv Test Tagesrapport')).toBeVisible();
  });
});
