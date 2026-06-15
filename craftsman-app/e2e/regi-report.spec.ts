import { test, expect, type Page } from '@playwright/test';
import { resetAndReload, waitForSeedProject } from './helpers';

/** Click a tab button directly to bypass sticky-header overlap. */
async function clickTab(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).first().dispatchEvent('click');
  await page.waitForTimeout(150);
}

test.describe('Regi report flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndReload(page);
  });

  test('creates a new regi report from dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /Regierapport/ }).first().click();
    await expect(page.getByText('Neuer Regierapport')).toBeVisible();
    await expect(page.getByText('Info')).toBeVisible();
    await expect(page.getByText(/Positionen/)).toBeVisible();
    await expect(page.getByText('Abschluss')).toBeVisible();
  });

  test('selects project and saves info', async ({ page }) => {
    await page.getByRole('button', { name: /Regierapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByLabel('Titel').fill('E2E Regierapport Test');
    await page.getByRole('button', { name: 'Speichern' }).click();

    await page.waitForURL(/\/regierapport\/.+/);
    await expect(page.getByText('E2E Regierapport Test')).toBeVisible();
  });

  test('adds a position (Arbeit)', async ({ page }) => {
    await page.getByRole('button', { name: /Regierapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL(/\/regierapport\/.+/);

    // Go to Positionen tab
    await clickTab(page, /Positionen/);
    await page.getByRole('button', { name: /Position hinzufügen/ }).click();

    await expect(page.getByText('Position hinzufügen').first()).toBeVisible();

    // Fill position
    await page.getByLabel('Beschreibung *').fill('Mauerwerk erstellen');
    await page.getByLabel('Menge').fill('8');
    await page.getByLabel('EP (CHF)').fill('75');

    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

    // Position shows in list under "Arbeit"
    await expect(page.getByText('Mauerwerk erstellen')).toBeVisible();
    await expect(page.getByText(/CHF.600\.00/).first()).toBeVisible();
  });

  test('summary tab shows totals with VAT', async ({ page }) => {
    await page.getByRole('button', { name: /Regierapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL(/\/regierapport\/.+/);

    // Add a position
    await clickTab(page, /Positionen/);
    await page.getByRole('button', { name: /Position hinzufügen/ }).click();
    await page.getByLabel('Beschreibung *').fill('Fundamentarbeiten');
    await page.getByLabel('Menge').fill('10');
    await page.getByLabel('EP (CHF)').fill('100');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

    // Go to Abschluss tab
    await clickTab(page, 'Abschluss');
    await expect(page.getByText('Nettototal')).toBeVisible();
    await expect(page.getByText('MWST')).toBeVisible();
    await expect(page.getByText('Gesamttotal')).toBeVisible();
    // Net is 1000, gross should be 1081.00 (8.1% VAT)
    await expect(page.getByText(/1.000\.00/).first()).toBeVisible();
  });

  test('signature flow – draw and confirm', async ({ page }) => {
    await page.getByRole('button', { name: /Regierapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL(/\/regierapport\/.+/);

    // Go to Abschluss
    await clickTab(page, 'Abschluss');

    // Fill customer name
    await page.getByLabel('Name Kunde').fill('Max Muster');

    // Open signature modal
    await page.getByText('Kundenunterschrift einholen').click();
    await expect(page.getByRole('heading', { name: 'Kundenunterschrift' })).toBeVisible();

    // Draw on signature canvas
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    // Simulate a signature stroke
    await page.mouse.move(box.x + 50, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 80, { steps: 10 });
    await page.mouse.move(box.x + 200, box.y + 120, { steps: 10 });
    await page.mouse.move(box.x + 280, box.y + 100, { steps: 10 });
    await page.mouse.up();

    // Confirm signature
    await page.getByRole('button', { name: 'Bestätigen & speichern' }).click();

    // Should show signed status
    await expect(page.getByText('Signiert')).toBeVisible();
    await expect(page.getByText('Unterzeichnet von')).toBeVisible();
    await expect(page.getByText('Max Muster')).toBeVisible();
  });

  test('mark as invoiced after signing', async ({ page }) => {
    await page.getByRole('button', { name: /Regierapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL(/\/regierapport\/.+/);

    // Sign the report
    await clickTab(page, 'Abschluss');
    await page.getByLabel('Name Kunde').fill('Hans Muster');
    await page.getByText('Kundenunterschrift einholen').click();

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    await page.mouse.move(box.x + 60, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 80, { steps: 15 });
    await page.mouse.move(box.x + 300, box.y + 130, { steps: 15 });
    await page.mouse.up();

    await page.getByRole('button', { name: 'Bestätigen & speichern' }).click();
    await expect(page.getByText('Signiert')).toBeVisible();

    // Now mark as invoiced
    await page.getByRole('button', { name: 'Als verrechnet markieren' }).click();

    // Should show invoiced badge
    await expect(page.getByText('Verrechnet')).toBeVisible();
    // The "Als verrechnet markieren" button should disappear
    await expect(page.getByRole('button', { name: 'Als verrechnet markieren' })).not.toBeVisible();
  });

  test('regi report appears in archive', async ({ page }) => {
    await page.getByRole('button', { name: /Regierapport/ }).first().click();
    await waitForSeedProject(page);

    await page.getByLabel('Projekt *').selectOption({ label: 'Neubau Einfamilienhaus Muster' });
    await page.getByLabel('Titel').fill('Archiv Test Regierapport');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.waitForURL(/\/regierapport\/.+/);

    await page.getByRole('link', { name: 'Archiv' }).click();
    await expect(page.getByText('Archiv Test Regierapport')).toBeVisible();
  });
});
