import { test, expect } from '@playwright/test';

test.describe('Explore button hover (dark mode)', () => {
  test('hover adds visible ring/shadow', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const button = page.getByRole('link', { name: /Explore gallery/i });
    await expect(button).toBeVisible();

    const before = await button.evaluate((el) => {
      const s = window.getComputedStyle(el as HTMLElement);
      return { boxShadow: s.boxShadow, filter: s.filter, outlineWidth: s.outlineWidth };
    });

    await button.hover();
    await page.waitForTimeout(150);

    const after = await button.evaluate((el) => {
      const s = window.getComputedStyle(el as HTMLElement);
      return { boxShadow: s.boxShadow, filter: s.filter, outlineWidth: s.outlineWidth };
    });

    // We expect some visual delta on hover, at least box-shadow or outline width
    expect(
      after.boxShadow !== before.boxShadow || after.filter !== before.filter
    ).toBeTruthy();
  });
});
