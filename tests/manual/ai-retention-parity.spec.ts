import { expect, type Locator, type Page, test } from '@playwright/test';
import { openAiSidebar, resetGuestState } from '../e2e/helpers/guest';
import { skipIfSecurityCheckpoint } from '../e2e/helpers/security';
import { TIMEOUTS } from '../e2e/helpers/timeouts';
import { navigateToDashboard } from '../e2e/helpers/ui-flow';

const TARGET_SERVER = 'api-was-dc1-01';

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

function trackApiStatuses(page: Page) {
  const statuses = {
    incidentReport: [] as number[],
    intelligentMonitoring: [] as number[],
  };

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/ai/incident-report')) {
      statuses.incidentReport.push(response.status());
    }
    if (url.includes('/api/ai/intelligent-monitoring')) {
      statuses.intelligentMonitoring.push(response.status());
    }
  });

  return statuses;
}

async function switchFunction(
  root: Page | Locator,
  target: 'chat' | 'reporter' | 'analyst'
) {
  const patterns = {
    chat: /AI Chat/,
    reporter: /(자동장애 보고서|장애 보고서).*Reporter Agent|장애 보고서/,
    analyst: /(이상감지\/예측).*Analyst Agent|이상감지\/예측/,
  } as const;

  const button = root.getByRole('button', { name: patterns[target] }).first();
  await expect(button).toBeVisible({ timeout: TIMEOUTS.COMPLEX_INTERACTION });
  await button.click();
}

async function openFullscreenWorkspace(page: Page) {
  await page.goto('/dashboard/ai-assistant', {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUTS.DASHBOARD_LOAD,
  });
  await skipIfSecurityCheckpoint(page, 'fullscreen-ai-workspace');
  await expect(page.getByText(/AI Workspace|AI Chat/).first()).toBeVisible({
    timeout: TIMEOUTS.COMPLEX_INTERACTION,
  });
  return page;
}

async function generateReporterResult(root: Page | Locator) {
  await switchFunction(root, 'reporter');

  const emptyCreateButton = root
    .getByRole('button', { name: '첫 보고서 생성하기' })
    .first();
  const createButton = root.getByRole('button', { name: '보고서 생성' }).first();

  if (
    await emptyCreateButton
      .isVisible({ timeout: TIMEOUTS.DOM_UPDATE })
      .catch(() => false)
  ) {
    await emptyCreateButton.click();
  } else {
    await expect(createButton).toBeVisible({
      timeout: TIMEOUTS.COMPLEX_INTERACTION,
    });
    await createButton.click();
  }

  await expect(
    root.getByText('영향받는 서버:', { exact: false }).first()
  ).toBeVisible({ timeout: TIMEOUTS.AI_RESPONSE });
  await expect(root.getByRole('button', { name: '상세보기' }).first()).toBeVisible({
    timeout: TIMEOUTS.AI_RESPONSE,
  });
}

async function assertReporterRetained(root: Page | Locator) {
  await expect(
    root.getByText('영향받는 서버:', { exact: false }).first()
  ).toBeVisible({ timeout: TIMEOUTS.COMPLEX_INTERACTION });
  await expect(root.getByRole('button', { name: '상세보기' }).first()).toBeVisible({
    timeout: TIMEOUTS.COMPLEX_INTERACTION,
  });
}

async function ensureRagEnabled(root: Page | Locator) {
  const ragButton = root.getByRole('button', { name: /^RAG$/ }).first();
  const currentClass = (await ragButton.getAttribute('class')) ?? '';

  if (!currentClass.includes('bg-purple-100')) {
    await ragButton.click();
  }

  await expect(ragButton).toHaveClass(/bg-purple-100/);
}

async function runAnalystAnalysis(root: Page | Locator) {
  await switchFunction(root, 'analyst');

  const targetSelect = root.getByLabel('분석 대상').first();
  await expect(targetSelect).toBeVisible({
    timeout: TIMEOUTS.COMPLEX_INTERACTION,
  });
  await targetSelect.selectOption({ label: TARGET_SERVER });

  await ensureRagEnabled(root);

  const analyzeButton = root
    .getByRole('button', { name: /분석 시작|전체 분석/ })
    .first();
  await expect(analyzeButton).toBeVisible({
    timeout: TIMEOUTS.COMPLEX_INTERACTION,
  });
  await analyzeButton.click();

  await expect(root.getByRole('heading', { name: '현재 상태' }).first()).toBeVisible({
    timeout: TIMEOUTS.AI_RESPONSE,
  });
}

async function assertAnalystRetained(root: Page | Locator) {
  const targetSelect = root.getByLabel('분석 대상').first();

  await expect
    .poll(
      () =>
        targetSelect.evaluate((element) => {
          const select = element as HTMLSelectElement;
          return select.selectedOptions[0]?.textContent?.trim() ?? '';
        }),
      { timeout: TIMEOUTS.COMPLEX_INTERACTION }
    )
    .toBe(TARGET_SERVER);

  await expect(root.getByRole('heading', { name: '현재 상태' }).first()).toBeVisible({
    timeout: TIMEOUTS.COMPLEX_INTERACTION,
  });
  await expect(root.getByRole('button', { name: /^RAG$/ }).first()).toHaveClass(
    /bg-purple-100/
  );
}

test.describe('AI retention parity manual', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await resetGuestState(page);
    await navigateToDashboard(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGuestState(page);
  });

  test('sidebar retains Reporter and Analyst state across chat switch', async ({
    page,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    const apiStatuses = trackApiStatuses(page);
    const sidebar = await openAiSidebar(page, {
      waitTimeout: TIMEOUTS.COMPLEX_INTERACTION,
    });

    await expect(sidebar).toBeVisible({ timeout: TIMEOUTS.COMPLEX_INTERACTION });

    await generateReporterResult(sidebar);
    await switchFunction(sidebar, 'chat');
    await switchFunction(sidebar, 'reporter');
    await assertReporterRetained(sidebar);

    await runAnalystAnalysis(sidebar);
    await switchFunction(sidebar, 'chat');
    await switchFunction(sidebar, 'analyst');
    await assertAnalystRetained(sidebar);

    expect(consoleErrors).toEqual([]);
    expect(apiStatuses.incidentReport).toContain(200);
    expect(apiStatuses.intelligentMonitoring).toContain(200);
  });

  test('fullscreen retains Reporter and Analyst state across chat switch', async ({
    page,
  }) => {
    const consoleErrors = trackConsoleErrors(page);
    const apiStatuses = trackApiStatuses(page);
    const workspace = await openFullscreenWorkspace(page);

    await generateReporterResult(workspace);
    await switchFunction(workspace, 'chat');
    await switchFunction(workspace, 'reporter');
    await assertReporterRetained(workspace);

    await runAnalystAnalysis(workspace);
    await switchFunction(workspace, 'chat');
    await switchFunction(workspace, 'analyst');
    await assertAnalystRetained(workspace);

    expect(consoleErrors).toEqual([]);
    expect(apiStatuses.incidentReport).toContain(200);
    expect(apiStatuses.intelligentMonitoring).toContain(200);
  });
});
