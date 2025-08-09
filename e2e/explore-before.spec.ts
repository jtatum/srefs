import { test, expect } from '@playwright/test';

test.describe('Explore button ::before is disabled', () => {
  test('no ::before content or background (dark)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const button = page.getByRole('link', { name: /Explore gallery/i });
    await expect(button).toBeVisible();

    const before = await button.evaluate((el) => {
      const s = getComputedStyle(el as HTMLElement, '::before');
      return {
        content: s.content,
        backgroundImage: s.backgroundImage,
      };
    });

    await button.hover();
    await page.waitForTimeout(100);

    const after = await button.evaluate((el) => {
      const s = getComputedStyle(el as HTMLElement, '::before');
      return {
        content: s.content,
        backgroundImage: s.backgroundImage,
      };
    });

    // Expect no pseudo background before and after hover
    const isNone = (v: string) => v === 'none' || v === '""' || v === 'normal';
    expect(isNone(before.content)).toBeTruthy();
    expect(before.backgroundImage).toBe('none');

    expect(isNone(after.content)).toBeTruthy();
    expect(after.backgroundImage).toBe('none');
  });
});
