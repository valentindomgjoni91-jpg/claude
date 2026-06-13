import { test, expect } from '@playwright/test';
import { resetAndReload } from './helpers';

test.describe('Smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await resetAndReload(page);
  });

  test('dashboard loads with greeting', async ({ page }) => {
    await expect(page.getByText('Guten Tag')).toBeVisible();
  });

  test('bottom navigation has 5 items', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav.getByText('Dashboard')).toBeVisible();
    await expect(nav.getByText('Projekte')).toBeVisible();
    await expect(nav.getByText('Zeiten')).toBeVisible();
    await expect(nav.getByText('Archiv')).toBeVisible();
    await expect(nav.getByText('Stammdaten')).toBeVisible();
  });

  test('quick action buttons visible on dashboard', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Tagesrapport/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Regierapport/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Projekt anlegen/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Zeiterfassung/ })).toBeVisible();
  });

  test('stat cards show counts', async ({ page }) => {
    // Seed creates one active project
    await expect(page.getByText('Aktive Projekte')).toBeVisible();
    await expect(page.getByText('Stunden diese Woche')).toBeVisible();
  });

  test('navigating to Projekte shows seed project', async ({ page }) => {
    await page.getByRole('link', { name: 'Projekte' }).click();
    await expect(page.getByText('Neubau Einfamilienhaus Muster').first()).toBeVisible();
  });

  test('navigating to Archiv shows empty list', async ({ page }) => {
    await page.getByRole('link', { name: 'Archiv' }).click();
    await expect(page.getByPlaceholder('Titel, Datum, Projekt oder Kunde')).toBeVisible();
  });

  test('navigating to Stammdaten shows master data tabs', async ({ page }) => {
    await page.getByRole('link', { name: 'Stammdaten' }).click();
    await expect(page.getByText('Mitarbeiter').first()).toBeVisible();
  });

  test('app header shows "Handwerker Rapport"', async ({ page }) => {
    await expect(page.getByText('Handwerker Rapport')).toBeVisible();
  });
});
