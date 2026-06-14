import { test, expect, type Page } from '@playwright/test';

// These specs exercise the calculator's interactive core + the SEO/share deep
// links against a running dev server with seeded data. Slugs below come from the
// version-controlled seed (prisma/seed.ts).
const VEHICLE_SLUG = 'sr5-auto-4x4-2015-2022'; // Toyota HiLux SR5 Auto 4x4
const CARAVAN_SLUG = '21-65-3-2020-2026'; // Jayco Silverline 21.65-3

const searchBox = (page: Page) => page.getByPlaceholder(/search/i).first();

test.beforeEach(async ({ page }) => {
  // Fail the test on any uncaught client error.
  page.on('pageerror', (e) => {
    throw new Error(`page error: ${e}`);
  });
});

test('vehicle picker: open, search, select → live results + schematic', async ({
  page,
}) => {
  await page.goto('/calculator/');
  const open = page.getByRole('button', { name: /select.*vehicle/i });
  await expect(open).toBeVisible();

  await open.click();
  await expect(searchBox(page)).toBeVisible();

  await searchBox(page).fill('hilux');
  const result = page
    .getByRole('button')
    .filter({ hasText: /HiLux SR5/i })
    .first();
  await expect(result).toBeVisible();
  await result.click();

  // Vehicle selected → journey assumptions + live results render.
  await expect(page.getByText(/journey assumptions/i).first()).toBeVisible();
  await expect(page.getByText('GVM', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/axle loads/i).first()).toBeVisible();
  // Side-profile schematic.
  await expect(
    page.locator('figure[aria-label*="schematic" i] svg').first(),
  ).toBeVisible();
});

test('SEO slug pre-fill: ?v=&c= loads the full rig', async ({ page }) => {
  await page.goto(`/calculator/?v=${VEHICLE_SLUG}&c=${CARAVAN_SLUG}`);

  await expect(page.getByText(/journey assumptions/i).first()).toBeVisible({
    timeout: 15_000,
  });
  // Vehicle + caravan compact cards.
  await expect(page.getByText(/HiLux SR5/i).first()).toBeVisible();
  await expect(page.getByText(/Silverline/i).first()).toBeVisible();
  // Caravan metrics appear only when a van is attached.
  await expect(
    page.getByText(/tow ball load|payload remaining/i).first(),
  ).toBeVisible();
});

test('accessory deep-link: ?v=&a= pre-loads accessories', async ({ page }) => {
  await page.goto(
    `/calculator/?v=${VEHICLE_SLUG}&a=summit-bullbar-hilux,t13-outback-bullbar-hilux`,
  );
  await expect(page.getByText(/HiLux SR5/i).first()).toBeVisible({
    timeout: 15_000,
  });
  // Accessory mass summary only renders when accessories are present.
  await expect(page.getByText(/accessories:\s*\d+\s*kg/i)).toBeVisible({
    timeout: 15_000,
  });
});

test('advanced panel expands to the weight breakdown', async ({ page }) => {
  await page.goto(`/calculator/?v=${VEHICLE_SLUG}`);
  await expect(page.getByText(/journey assumptions/i).first()).toBeVisible({
    timeout: 15_000,
  });
  const adv = page
    .getByRole('button', { name: /advanced.*weight breakdown/i })
    .first();
  await adv.click();
  await expect(page.getByText(/methodology/i).first()).toBeVisible();
});
