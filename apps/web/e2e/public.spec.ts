import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

const processId = '11111111-1111-4111-8111-111111111111';

async function headingLineTop(page: Page, phrase: string): Promise<number> {
  return page.locator('#hero-title').evaluate((heading, target) => {
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const parts: Array<{ node: Text; start: number; end: number }> = [];
    let text = '';
    let current = walker.nextNode();
    while (current) {
      const node = current as Text;
      parts.push({ node, start: text.length, end: text.length + node.data.length });
      text += node.data;
      current = walker.nextNode();
    }

    const start = text.indexOf(target);
    if (start < 0) throw new Error(`Headline is missing “${target}”`);
    const end = start + target.length;
    const startPart = parts.find((part) => start >= part.start && start < part.end);
    const endPart = parts.find((part) => end > part.start && end <= part.end);
    if (!startPart || !endPart) throw new Error(`Could not locate “${target}” in headline nodes`);

    const range = document.createRange();
    range.setStart(startPart.node, start - startPart.start);
    range.setEnd(endPart.node, end - endPart.start);
    return Math.round(range.getBoundingClientRect().top);
  }, phrase);
}

const card = {
  id: processId,
  noticeCode: 'EDITAL-01/2026',
  selectionType: 'Seleção por histórico escolar',
  requiresEnem: false,
  verifiedAt: '2026-10-30T12:00:00.000Z',
  officialNoticeUrl: 'https://universidade.example/edital-fixture',
  institution: {
    id: 'institution-fixture',
    name: 'Universidade Pública de Teste',
    acronym: 'UPT',
  },
  offeringCount: 1,
  coursePreview: ['Engenharia'],
  nextDeadlineAt: '2026-12-15',
  applicationStatus: 'ABERTA',
} as const;

const detail = {
  id: processId,
  noticeCode: 'EDITAL-01/2026',
  noticeYear: 2026,
  selectionType: 'Seleção por histórico escolar',
  requiresEnem: false,
  tuitionFree: true,
  verifiedAt: '2026-10-30T12:00:00.000Z',
  applicationStatus: 'ABERTA',
  officialNoticeUrl: 'https://universidade.example/edital-fixture',
  institution: {
    ...card.institution,
    jurisdiction: 'FEDERAL',
  },
  offerings: [
    {
      id: 'offering-fixture',
      courseName: 'Engenharia',
      degreeType: 'Bacharelado',
      modality: 'Presencial',
      shift: 'Integral',
      seats: 2,
      campus: {
        id: 'campus-fixture',
        name: 'Campus Central',
        city: 'Cidade de Teste',
        state: 'PB',
        timezone: 'America/Fortaleza',
        verifiedAt: '2026-10-30T12:00:00.000Z',
      },
      reservations: [{ id: 'reservation-fixture', category: 'Ampla concorrência', seats: 2 }],
    },
  ],
  windows: [
    {
      id: 'window-fixture',
      offeringId: 'offering-fixture',
      label: 'Inscrições',
      applicationStatus: 'ABERTA',
      startDate: '2026-11-01',
      startTime: '08:00',
      endDate: '2026-12-15',
      endTime: '18:00',
      timezone: 'America/Fortaleza',
      instructionsUrl: 'https://universidade.example/inscricao-fixture',
    },
  ],
  requirements: [
    {
      id: 'requirement-fixture',
      offeringId: 'offering-fixture',
      reservationId: null,
      criterion: 'Histórico escolar',
      required: true,
      value: null,
    },
  ],
  evidence: [],
} as const;

async function fulfillJson(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': 'http://127.0.0.1:4301' },
    body: JSON.stringify(data),
  });
}

async function mockPublicApi(page: Page): Promise<void> {
  await page.route('http://127.0.0.1:3000/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/processes' && route.request().method() === 'GET') {
      const empty = url.searchParams.get('q')?.toLowerCase().includes('inexistente') ?? false;
      await fulfillJson(route, {
        data: empty ? [] : [card],
        meta: {
          page: Number(url.searchParams.get('page') ?? 1),
          pageSize: 25,
          total: empty ? 0 : 1,
        },
      });
      return;
    }
    const detailMatch = url.pathname.match(/^\/api\/v1\/processes\/([^/]+)$/);
    if (detailMatch) {
      if (detailMatch[1] !== processId) {
        await fulfillJson(
          route,
          { error: { code: 'NOT_FOUND', message: 'Not found', status: 404, requestId: 'e2e' } },
          404,
        );
      } else {
        await fulfillJson(route, detail);
      }
      return;
    }
    if (url.pathname === '/api/v1/institutions') {
      await fulfillJson(route, { data: [], meta: { page: 1, pageSize: 25, total: 0 } });
      return;
    }
    await fulfillJson(
      route,
      { error: { code: 'NOT_FOUND', message: 'Not found', status: 404, requestId: 'e2e' } },
      404,
    );
  });
}

async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.beforeEach(async ({ page }) => mockPublicApi(page));

test('keeps filters in the URL, supports browser history and displays a truthful empty state', async ({
  page,
}) => {
  await page.goto('/oportunidades?type=VESTIBULAR_PROPRIO&page=2');
  await expect(page.getByRole('heading', { name: 'EDITAL-01/2026' })).toBeVisible();
  await expect(page.getByLabel('Curso, edital ou instituição')).toHaveValue('');

  await page.getByLabel('Curso, edital ou instituição').fill('Engenharia');
  await expect(page).toHaveURL(/q=Engenharia/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByRole('heading', { name: 'EDITAL-01/2026' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/type=VESTIBULAR_PROPRIO/);
  await expect(page).toHaveURL(/page=2/);

  await page.getByLabel('Curso, edital ou instituição').fill('inexistente');
  await expect(
    page.getByRole('heading', { name: 'Nenhum processo verificado nesta busca.' }),
  ).toBeVisible();
  await expect(page.getByText(/Isso não significa que não existam oportunidades/)).toBeVisible();
});

test('shows public detail, safe official exit and a non-indexable 404', async ({ page }) => {
  await page.goto('/oportunidades');
  await page.getByRole('link', { name: /Ver detalhes e requisitos/ }).click();
  await expect(page).toHaveURL(new RegExp(`/oportunidades/${processId}$`));
  await expect(page.getByRole('heading', { name: /EDITAL-01\/2026/ })).toBeVisible();
  await expect(page.getByText('Campus Central', { exact: true })).toBeVisible();
  const officialLink = page.getByRole('link', { name: /Abrir edital oficial/ });
  await expect(officialLink).toHaveAttribute('href', 'https://universidade.example/edital-fixture');
  await expect(officialLink).toHaveAttribute('target', '_blank');
  await expect(officialLink).toHaveAttribute('rel', 'noopener noreferrer');
  await page.context().route('https://universidade.example/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<h1>Fixture externa de teste</h1>',
    }),
  );
  const popup = page.waitForEvent('popup');
  await officialLink.click();
  const externalPage = await popup;
  await expect(
    externalPage.getByRole('heading', { name: 'Fixture externa de teste' }),
  ).toBeVisible();
  await externalPage.close();

  await page.goto('/oportunidades/22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('alert')).toContainText('não está disponível no catálogo público');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('opens and closes the mobile menu with keyboard-accessible focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const mobileWidth = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(mobileWidth.content).toBeLessThanOrEqual(mobileWidth.viewport);
  }
  const menuButton = page.getByRole('button', { name: 'Abrir menu' });
  await expect(menuButton).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('.brand')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menuButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expectNoA11yViolations(page);
  const institutionsLink = page.getByRole('link', { name: 'Instituições' });
  await expect(institutionsLink).toBeVisible();
  await institutionsLink.click();
  await expect(page).toHaveURL(/\/instituicoes$/);
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Instituições' })).toBeHidden();
});

test('keeps the opening words of the home headline together at desktop and mobile widths', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await headingLineTop(page, 'A')).toBe(await headingLineTop(page, 'universidade'));
  }
  await page.setViewportSize({ width: 1440, height: 844 });
  const secondLineTop = await headingLineTop(page, 'pública');
  for (const word of ['pública', 'vai', 'além']) {
    expect(Math.abs((await headingLineTop(page, word)) - secondLineTop)).toBeLessThanOrEqual(8);
  }
});

test('meets automated WCAG 2.2 AA checks on home, listing, empty state, detail and directory', async ({
  page,
}) => {
  for (const path of ['/', '/oportunidades', '/oportunidades?q=inexistente', '/instituicoes']) {
    await page.goto(path);
    await page.getByRole('main').waitFor();
    await expectNoA11yViolations(page);
  }
  await page.goto(`/oportunidades/${processId}`);
  await page.getByRole('heading', { name: /EDITAL-01\/2026/ }).waitFor();
  await expectNoA11yViolations(page);
  await page.goto('/oportunidades/22222222-2222-4222-8222-222222222222');
  await page.getByRole('alert').waitFor();
  await expectNoA11yViolations(page);
});
