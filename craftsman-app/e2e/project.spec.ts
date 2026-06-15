import { test, expect } from '@playwright/test';
import { resetAndReload } from './helpers';

test.describe('Project management', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndReload(page);
  });

  test('seed project appears in project list', async ({ page }) => {
    await page.getByRole('link', { name: 'Projekte' }).click();
    await expect(page.getByText('Neubau Einfamilienhaus Muster').first()).toBeVisible();
    await expect(page.getByText('Familie Muster').first()).toBeVisible();
  });

  test('create a new project', async ({ page }) => {
    await page.getByRole('link', { name: 'Projekte' }).click();
    // The header action button says "Neu"
    await page.getByRole('button', { name: 'Neu', exact: true }).click();
    await expect(page.getByText('Projekt anlegen')).toBeVisible();

    // Fill in the project form with correct labels from ProjectForm.tsx
    await page.getByLabel('Projektbezeichnung *').fill('Testprojekt Playwright');
    await page.getByLabel('Kunde *').fill('Playwright AG');
    await page.getByLabel('Baustellenadresse *').fill('Testgasse 42, 8000 Zürich');

    // Save navigates to project detail
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Testprojekt Playwright').first()).toBeVisible();
  });

  test('project detail shows stats card', async ({ page }) => {
    await page.getByRole('link', { name: 'Projekte' }).click();
    await page.getByRole('button', { name: 'Neubau Einfamilienhaus Muster' }).first().click();
    await expect(page.getByText('Projektstatistik')).toBeVisible();
    await expect(page.getByText('Stunden')).toBeVisible();
    await expect(page.getByText('Material')).toBeVisible();
    await expect(page.getByText('Maschinen')).toBeVisible();
  });

  test('project detail shows quick action buttons', async ({ page }) => {
    await page.getByRole('link', { name: 'Projekte' }).click();
    await page.getByRole('button', { name: 'Neubau Einfamilienhaus Muster' }).first().click();
    await expect(page.getByRole('button', { name: /Tagesrapport/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Regierapport/ })).toBeVisible();
  });

  test('can navigate from project to new daily report', async ({ page }) => {
    await page.getByRole('link', { name: 'Projekte' }).click();
    await page.getByRole('button', { name: 'Neubau Einfamilienhaus Muster' }).first().click();
    // The first Tagesrapport button in the Quick Actions grid
    await page.getByRole('button', { name: /Tagesrapport/ }).first().click();
    await expect(page.getByText('Neuer Tagesrapport')).toBeVisible();
    // The project should be pre-selected
    const selected = await page.getByLabel('Projekt *').inputValue();
    expect(selected).not.toBe('');
  });
});
