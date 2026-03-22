import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { openAiSidebar, resetGuestState } from '../e2e/helpers/guest';
import { TIMEOUTS } from '../e2e/helpers/timeouts';
import { navigateToDashboard } from '../e2e/helpers/ui-flow';

const PROMPT = 'lb-haproxy-dc1-01 CPU 상태와 즉시 조치 항목 3가지를 요약해줘';

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

test.describe('Production feedback trace status manual', () => {
  test.beforeEach(async ({ page }) => {
    await resetGuestState(page);
    await navigateToDashboard(page);
  });

  test.afterEach(async ({ page }) => {
    await resetGuestState(page);
  });

  test('feedback response exposes explicit traceUrlStatus contract', async ({
    page,
  }, testInfo) => {
    const consoleErrors = trackConsoleErrors(page);
    const sidebar = await openAiSidebar(page, {
      waitTimeout: TIMEOUTS.COMPLEX_INTERACTION,
    });

    await expect(sidebar).toBeVisible({
      timeout: TIMEOUTS.COMPLEX_INTERACTION,
    });

    const input = page.getByRole('textbox', { name: 'AI 질문 입력' });
    await expect(input).toBeVisible({ timeout: TIMEOUTS.COMPLEX_INTERACTION });
    await input.fill(PROMPT);
    await input.press('Enter');

    const negativeButton = page
      .getByRole('button', { name: '개선이 필요해요' })
      .last();
    await expect(negativeButton).toBeVisible({ timeout: TIMEOUTS.AI_RESPONSE });

    const feedbackResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/ai/feedback') &&
        response.request().method() === 'POST',
      { timeout: TIMEOUTS.AI_RESPONSE }
    );

    await negativeButton.click();

    const feedbackResponse = await feedbackResponsePromise;
    expect(feedbackResponse.status()).toBe(200);

    const requestBody = feedbackResponse.request().postDataJSON() as {
      traceId?: string;
      type?: string;
      messageId?: string;
    };
    const responseBody = (await feedbackResponse.json()) as {
      success?: boolean;
      langfuseStatus?: string;
      traceId?: string;
      traceApiUrl?: string;
      dashboardUrl?: string;
      traceUrl?: string;
      traceUrlStatus?: 'available' | 'unavailable';
      monitoringLookupUrl?: string;
    };

    expect(responseBody.success).toBe(true);
    expect(responseBody.langfuseStatus).toBe('success');
    expect(responseBody.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(responseBody.traceApiUrl).toContain('/api/public/traces/');
    expect(responseBody.dashboardUrl).toContain('langfuse.com/project');
    expect(['available', 'unavailable']).toContain(responseBody.traceUrlStatus);
    expect(responseBody.monitoringLookupUrl).toContain('/monitoring/traces?q=');

    if (responseBody.traceUrlStatus === 'available') {
      expect(responseBody.traceUrl).toContain('langfuse.com');
    } else {
      expect(responseBody.traceUrl).toBeUndefined();
    }

    const responseRecord = {
      status: feedbackResponse.status(),
      url: feedbackResponse.url(),
      requestBody,
      responseBody,
    };

    const responsePath = testInfo.outputPath(
      'feedback-trace-status-response.json'
    );
    await fs.writeFile(
      responsePath,
      `${JSON.stringify(responseRecord, null, 2)}\n`,
      'utf8'
    );

    const screenshotPath = testInfo.outputPath('feedback-trace-status.png');
    await page.screenshot({
      path: screenshotPath,
      fullPage: false,
    });

    await testInfo.attach('feedback-response-json', {
      path: responsePath,
      contentType: 'application/json',
    });
    await testInfo.attach('feedback-screenshot', {
      path: screenshotPath,
      contentType: 'image/png',
    });

    expect(consoleErrors).toEqual([]);

    await testInfo.attach('feedback-trace-summary', {
      body: Buffer.from(
        [
          `traceId=${responseBody.traceId}`,
          `traceUrlStatus=${responseBody.traceUrlStatus}`,
          `traceApiUrl=${responseBody.traceApiUrl}`,
          `traceUrl=${responseBody.traceUrl ?? ''}`,
          `monitoringLookupUrl=${responseBody.monitoringLookupUrl}`,
          `responseJson=${path.basename(responsePath)}`,
        ].join('\n'),
        'utf8'
      ),
      contentType: 'text/plain',
    });
  });
});
