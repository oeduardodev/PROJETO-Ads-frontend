import { expect, test } from '@playwright/test';

test('local staging loads the honest empty catalog from the real API', async ({ page }) => {
  const publicResponses: Array<{ url: string; status: number }> = [];
  page.on('response', (response) => {
    if (/\/api\/v1\/(?:processes|filters|institutions)(?:\?|$)/u.test(response.url())) {
      publicResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await page.goto('/oportunidades');
  await expect(
    page.getByRole('heading', { name: 'Nenhum processo verificado nesta busca.' }),
  ).toBeVisible();
  await expect(page.getByText(/Isso não significa que não existam oportunidades/)).toBeVisible();
  expect(publicResponses.length).toBeGreaterThan(0);
  expect(publicResponses.every((response) => response.status === 200)).toBe(true);
});
