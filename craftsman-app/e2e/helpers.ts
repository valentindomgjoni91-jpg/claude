import { type Page, type BrowserContext } from '@playwright/test';

/** Delete CraftsmanDB and reload, then wait for the dashboard to appear. */
export async function resetAndReload(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() =>
    new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('CraftsmanDB');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // proceed even on error
      req.onblocked = () => resolve();
    })
  );
  await page.reload();
  // Wait for App to mount and seed data to finish
  await page.waitForSelector('text=Guten Tag', { timeout: 15_000 });
}

/** Wait for the seed project to appear in a dropdown. */
export async function waitForSeedProject(page: Page): Promise<string> {
  await page.waitForFunction(() => {
    const selects = document.querySelectorAll('select');
    for (const s of selects) {
      for (const o of s.options) {
        if (o.text.includes('Neubau')) return true;
      }
    }
    return false;
  }, undefined, { timeout: 10_000 });
  return 'Neubau Einfamilienhaus Muster';
}

/** Create a fresh browser context and return a clean page. */
export async function freshPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await resetAndReload(page);
  return page;
}
