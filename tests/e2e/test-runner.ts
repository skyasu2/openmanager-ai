/**
 * 🤖 AI 기반 E2E 테스트 실행기
 *
 * 기능:
 * - 테스트 카테고리별 선택적 실행
 * - 실시간 진행 상황 모니터링
 * - 테스트 결과 자동 리포트 생성
 * - CI/CD 파이프라인 통합 지원
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ADMIN_FEATURES_REMOVED } from './helpers/featureFlags';

export interface TestConfig {
  category: 'all' | 'basic' | 'ai' | 'performance' | 'visual' | 'accessibility';
  browser: 'chromium' | 'firefox' | 'webkit' | 'all';
  headless: boolean;
  workers: number;
  timeout: number;
  retries: number;
  reportFormat: 'html' | 'json' | 'junit' | 'github' | 'all';
  outputDir: string;
}

export interface TestResult {
  category: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
  warnings: string[];
}

/** 테스트 카테고리 정의 */
export interface TestCategory {
  name: string;
  file: string;
  priority: number;
  estimatedTime: number;
}

/** Playwright JSON 리포터 Spec 구조 */
interface PlaywrightSpec {
  ok: boolean;
  title?: string;
}

/** Playwright JSON 리포터 Suite 구조 */
interface PlaywrightSuite {
  specs?: PlaywrightSpec[];
  title?: string;
}

/** Playwright 테스트 실행 결과 */
interface PlaywrightTestResult {
  passed: number;
  failed: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

/** 리포트 데이터 구조 */
interface ReportData {
  timestamp: string;
  config: TestConfig;
  summary: ReturnType<E2ETestRunner['generateSummary']>;
  results: TestResult[];
  recommendations: string[];
}

export class E2ETestRunner {
  private config: TestConfig;
  private results: TestResult[] = [];

  constructor(config: Partial<TestConfig> = {}) {
    this.config = {
      category: 'all',
      browser: 'chromium',
      headless: true,
      workers: 1,
      timeout: 30000,
      retries: 2,
      reportFormat: 'html',
      outputDir: './test-results',
      ...config,
    };
  }

  /**
   * 🚀 테스트 실행 메인 함수
   */
  async runTests(): Promise<TestResult[]> {
    console.log('🧪 OpenManager AI E2E 테스트 시작');
    console.log('📊 테스트 설정:', this.config);

    try {
      // 출력 디렉토리 생성
      await this.ensureOutputDirectory();

      // 테스트 카테고리별 실행
      const testCategories = this.getTestCategories();

      for (const category of testCategories) {
        console.log(`\n🎯 ${category.name} 테스트 실행 중...`);
        const result = await this.runTestCategory(category);
        this.results.push(result);
      }

      // 결과 리포트 생성
      await this.generateReport();

      console.log('\n✅ 모든 테스트 완료');
      return this.results;
    } catch (error) {
      console.error('❌ 테스트 실행 중 오류:', error);
      throw error;
    }
  }

  /**
   * 📋 테스트 카테고리 정의
   */
  private getTestCategories() {
    const adminDisabledFiles = new Set([
      'comprehensive-ui-ux-test.spec.ts',
      'ai-assistant-advanced-test.spec.ts',
      'admin-mode-improved.spec.ts',
    ]);

    const allCategories = [
      {
        name: '게스트 모드',
        file: 'guest.spec.ts',
        priority: 1,
        estimatedTime: 90000, // 1.5분
      },
      {
        name: '성능 및 시각적 회귀 테스트',
        file: 'performance.spec.ts',
        priority: 3,
        estimatedTime: 300000, // 5분
      },
    ];

    const filteredCategories = allCategories.filter(
      (cat) => !(ADMIN_FEATURES_REMOVED && adminDisabledFiles.has(cat.file))
    );

    // 카테고리 필터링
    if (this.config.category === 'all') {
      return filteredCategories;
    }

    const categoryMap: Record<string, string[]> = {
      basic: [
        'comprehensive-ui-ux-test.spec.ts',
        'admin-mode-improved.spec.ts',
        'guest-dashboard-flow.spec.ts',
      ],
      ai: ['ai-assistant-advanced-test.spec.ts'],
      performance: ['performance.spec.ts'],
      visual: ['visual-regression.spec.ts'],
      accessibility: ['accessibility.spec.ts'],
    };

    const selectedFiles = categoryMap[this.config.category] || [];
    return filteredCategories.filter((cat) => selectedFiles.includes(cat.file));
  }

  /**
   * 🧪 개별 테스트 카테고리 실행
   */
  private async runTestCategory(category: TestCategory): Promise<TestResult> {
    const startTime = Date.now();
    const testFile = path.join('./tests/e2e', category.file);

    console.log(`   📂 테스트 파일: ${category.file}`);
    console.log(
      `   ⏱️ 예상 소요시간: ${(category.estimatedTime / 1000).toFixed(0)}초`
    );

    try {
      const result = await this.executePlaywrightTest(testFile);
      const duration = Date.now() - startTime;

      console.log(
        `   ✅ ${category.name} 완료 (${(duration / 1000).toFixed(1)}초)`
      );

      return {
        category: category.name,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        duration,
        errors: result.errors,
        warnings: result.warnings,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`   ❌ ${category.name} 실패:`, error);

      return {
        category: category.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  /**
   * 🎭 Playwright 테스트 실행
   */
  private async executePlaywrightTest(
    testFile: string
  ): Promise<PlaywrightTestResult> {
    return new Promise((resolve, reject) => {
      const args = [
        'test',
        testFile,
        `--project=${this.config.browser}`,
        `--workers=${this.config.workers}`,
        `--timeout=${this.config.timeout}`,
        `--retries=${this.config.retries}`,
        `--reporter=json`,
        `--output-dir=${this.config.outputDir}`,
      ];

      if (this.config.headless) {
        args.push('--headed=false');
      }

      const playwrightProcess = spawn('npx', ['playwright', ...args], {
        stdio: 'pipe',
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      playwrightProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        // 실시간 로그 출력
        process.stdout.write(data);
      });

      playwrightProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      playwrightProcess.on('close', (code) => {
        if (code === 0) {
          // JSON 결과 파싱
          try {
            const resultData = this.parsePlaywrightOutput(stdout);
            resolve(resultData);
          } catch (_error) {
            resolve({
              passed: 1,
              failed: 0,
              skipped: 0,
              errors: [],
              warnings: [],
            });
          }
        } else {
          reject(
            new Error(`Playwright 프로세스 종료 코드: ${code}\n${stderr}`)
          );
        }
      });

      // 타임아웃 설정
      setTimeout(() => {
        playwrightProcess.kill();
        reject(new Error('테스트 실행 타임아웃'));
      }, this.config.timeout * 2); // 설정된 타임아웃의 2배
    });
  }

  /**
   * 📊 Playwright 출력 파싱
   */
  private parsePlaywrightOutput(output: string): PlaywrightTestResult {
    try {
      // JSON 리포터 출력에서 결과 추출
      const lines = output.split('\n');
      const jsonLine = lines.find(
        (line) => line.trim().startsWith('{') && line.includes('passed')
      );

      if (jsonLine) {
        const result = JSON.parse(jsonLine) as { suites?: PlaywrightSuite[] };
        return {
          passed:
            result.suites?.reduce(
              (sum: number, suite: PlaywrightSuite) =>
                sum +
                (suite.specs?.filter((spec: PlaywrightSpec) => spec.ok)
                  .length || 0),
              0
            ) || 0,
          failed:
            result.suites?.reduce(
              (sum: number, suite: PlaywrightSuite) =>
                sum +
                (suite.specs?.filter((spec: PlaywrightSpec) => !spec.ok)
                  .length || 0),
              0
            ) || 0,
          skipped: 0,
          errors: [],
          warnings: [],
        };
      }
    } catch (error) {
      console.warn('📊 결과 파싱 실패, 기본값 사용:', error);
    }

    // 파싱 실패 시 기본값
    return {
      passed: output.includes('passed') ? 1 : 0,
      failed: output.includes('failed') ? 1 : 0,
      skipped: 0,
      errors: [],
      warnings: [],
    };
  }

  /**
   * 📁 출력 디렉토리 생성
   */
  private async ensureOutputDirectory(): Promise<void> {
    const outputDir = path.resolve(this.config.outputDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * 📄 테스트 결과 리포트 생성
   */
  private async generateReport(): Promise<void> {
    const reportData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      summary: this.generateSummary(),
      results: this.results,
      recommendations: this.generateRecommendations(),
    };

    // HTML 리포트
    if (
      this.config.reportFormat === 'html' ||
      this.config.reportFormat === 'all'
    ) {
      await this.generateHTMLReport(reportData);
    }

    // JSON 리포트
    if (
      this.config.reportFormat === 'json' ||
      this.config.reportFormat === 'all'
    ) {
      await this.generateJSONReport(reportData);
    }

    // GitHub Actions 형식
    if (this.config.reportFormat === 'github') {
      await this.generateGitHubReport(reportData);
    }

    console.log('📄 테스트 리포트 생성 완료');
  }

  /**
   * 📊 테스트 요약 생성
   */
  private generateSummary() {
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const totalTests = totalPassed + totalFailed + totalSkipped;

    return {
      totalTests,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      successRate:
        totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : '0',
      duration: totalDuration,
      categories: this.results.length,
    };
  }

  /**
   * 💡 개선 권장사항 생성
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const summary = this.generateSummary();

    if (parseFloat(summary.successRate) < 90) {
      recommendations.push(
        '🔴 테스트 성공률이 90% 미만입니다. 실패한 테스트를 검토하세요.'
      );
    }

    if (summary.duration > 600000) {
      // 10분 초과
      recommendations.push(
        '⚡ 테스트 실행 시간이 10분을 초과합니다. 병렬 실행을 고려하세요.'
      );
    }

    const failedCategories = this.results.filter((r) => r.failed > 0);
    if (failedCategories.length > 0) {
      recommendations.push(
        `🧪 다음 카테고리에서 실패: ${failedCategories.map((r) => r.category).join(', ')}`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ 모든 테스트가 성공적으로 완료되었습니다!');
    }

    return recommendations;
  }

  /**
   * 🌐 HTML 리포트 생성
   */
  private async generateHTMLReport(data: ReportData): Promise<void> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenManager AI E2E 테스트 리포트</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0; color: #495057; }
        .metric .value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .results { margin: 20px 0; }
        .category { background: white; border: 1px solid #dee2e6; border-radius: 8px; margin: 10px 0; padding: 15px; }
        .recommendations { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .recommendations ul { margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 OpenManager AI E2E 테스트 리포트</h1>
        <p>생성 시간: ${data.timestamp}</p>
        <p>테스트 설정: ${data.config.category} / ${data.config.browser} / Workers: ${data.config.workers}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>전체 테스트</h3>
            <div class="value">${data.summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>성공</h3>
            <div class="value passed">${data.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>실패</h3>
            <div class="value failed">${data.summary.failed}</div>
        </div>
        <div class="metric">
            <h3>성공률</h3>
            <div class="value">${data.summary.successRate}%</div>
        </div>
        <div class="metric">
            <h3>소요시간</h3>
            <div class="value">${(data.summary.duration / 1000).toFixed(1)}초</div>
        </div>
    </div>
    
    <div class="results">
        <h2>📊 카테고리별 결과</h2>
        ${data.results
          .map(
            (result: TestResult) => `
            <div class="category">
                <h3>${result.category}</h3>
                <p>성공: <span class="passed">${result.passed}</span> | 
                   실패: <span class="failed">${result.failed}</span> | 
                   건너뜀: <span class="skipped">${result.skipped}</span> | 
                   소요시간: ${(result.duration / 1000).toFixed(1)}초</p>
                ${
                  result.errors.length > 0
                    ? `
                    <details>
                        <summary style="color: #dc3545; cursor: pointer;">❌ 오류 ${result.errors.length}개</summary>
                        <ul>
                            ${result.errors.map((error) => `<li>${error}</li>`).join('')}
                        </ul>
                    </details>
                `
                    : ''
                }
            </div>
        `
          )
          .join('')}
    </div>
    
    <div class="recommendations">
        <h2>💡 권장사항</h2>
        <ul>
            ${data.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;

    const reportPath = path.join(this.config.outputDir, 'test-report.html');
    fs.writeFileSync(reportPath, htmlContent);
    console.log(`📄 HTML 리포트: ${reportPath}`);
  }

  /**
   * 📋 JSON 리포트 생성
   */
  private async generateJSONReport(data: ReportData): Promise<void> {
    const reportPath = path.join(this.config.outputDir, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(data, null, 2));
    console.log(`📄 JSON 리포트: ${reportPath}`);
  }

  /**
   * 🐙 GitHub Actions 형식 리포트
   */
  private async generateGitHubReport(data: ReportData): Promise<void> {
    const summary = data.summary;
    const emoji = summary.failed > 0 ? '❌' : '✅';

    const githubSummary = `
## ${emoji} OpenManager AI E2E 테스트 결과

### 📊 요약
- **전체 테스트**: ${summary.totalTests}개
- **성공**: ${summary.passed}개 
- **실패**: ${summary.failed}개
- **성공률**: ${summary.successRate}%
- **소요시간**: ${(summary.duration / 1000).toFixed(1)}초

### 📋 카테고리별 결과
${data.results
  .map(
    (result: TestResult) => `
- **${result.category}**: ${result.passed}개 성공, ${result.failed}개 실패 (${(result.duration / 1000).toFixed(1)}초)
`
  )
  .join('')}

### 💡 권장사항
${data.recommendations.map((rec: string) => `- ${rec}`).join('\n')}
`;

    const reportPath = path.join(this.config.outputDir, 'github-summary.md');
    fs.writeFileSync(reportPath, githubSummary);
    console.log(`📄 GitHub 리포트: ${reportPath}`);

    // GitHub Actions 환경에서 Step Summary 설정
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, githubSummary);
    }
  }
}

/**
 * 🚀 CLI 실행 인터페이스
 */
export async function runE2ETests(
  options: Partial<TestConfig> = {}
): Promise<void> {
  const runner = new E2ETestRunner(options);

  try {
    const results = await runner.runTests();
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    if (totalFailed > 0) {
      console.error(`\n❌ ${totalFailed}개 테스트 실패`);
      process.exit(1);
    } else {
      console.log('\n✅ 모든 테스트 성공');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 테스트 실행 중 치명적 오류:', error);
    process.exit(1);
  }
}

// CLI에서 직접 실행 시
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: Partial<TestConfig> = {};

  // 간단한 CLI 파라미터 파싱
  args.forEach((arg) => {
    if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1] as TestConfig['category'];
    } else if (arg.startsWith('--browser=')) {
      options.browser = arg.split('=')[1] as TestConfig['browser'];
    } else if (arg === '--headed') {
      options.headless = false;
    } else if (arg.startsWith('--workers=')) {
      options.workers = parseInt(arg.split('=')[1], 10);
    }
  });

  runE2ETests(options);
}
