import { expect, type Page } from '@playwright/test';

/** New Game always opens the picker (GDD §10.7). Default path for existing e2e is Normal. */
export async function startNewGame(
  page: Page,
  difficulty: 'easy' | 'normal' | 'hard' = 'normal',
): Promise<void> {
  await page.getByTestId('menu-new-run').click();
  await expect(page.getByTestId('difficulty')).toBeVisible();
  await page.getByTestId(`difficulty-${difficulty}`).click();
}
