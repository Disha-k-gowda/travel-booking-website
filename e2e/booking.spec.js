const { test, expect } = require('@playwright/test');

test('user can view destinations and submit a booking', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Curated Destinations')).toBeVisible();
  const cardCount = await page.locator('.card').count();
  expect(cardCount).toBeGreaterThanOrEqual(8);

  await page.locator('.book-btn:not([disabled])').first().click();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 4);

  const toInputDate = (date) => date.toISOString().slice(0, 10);

  await page.getByLabel('Full Name').fill('Test Traveler');
  await page.getByLabel('Email').fill('traveler@example.com');
  await page.getByLabel('Travelers').fill('2');
  await page.getByLabel('Start Date').fill(toInputDate(tomorrow));
  await page.getByLabel('End Date').fill(toInputDate(nextWeek));

  await page.getByRole('button', { name: 'Book now' }).click();
  await expect(page.getByText('Booking confirmed.')).toBeVisible();
});
