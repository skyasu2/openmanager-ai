#!/usr/bin/env node

/**
 * 🚀 OpenManager v5.7.4 부하 테스트 스크립트
 *
 * 목표:
 * 1. 시스템 시작 기능 부하 테스트
 * 2. 데이터 생성 기능 부하 테스트
 * 3. 동시 사용자 시뮬레이션
 */

const http = require('node:http');

class LoadTester {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.results = {
      systemStart: [],
      dataGenerator: [],
      errors: [],
      summary: {},
    };
    this.concurrentUsers = 10;
    this.testDuration = 30000; // 30초
  }

  /**
   * 🔧 HTTP 요청 헬퍼
   */
  async makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoadTester/1.0',
        },
        timeout: 15000,
      };

      if (data) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      const startTime = Date.now();
      const req = http.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          const endTime = Date.now();
          resolve({
            statusCode: res.statusCode,
            responseTime: endTime - startTime,
            data: responseData,
            headers: res.headers,
          });
        });
      });

      req.on('error', (err) => {
        reject({
          error: err.message,
          responseTime: Date.now() - startTime,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject({
          error: 'Request timeout',
          responseTime: 15000,
        });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * 🚀 시스템 시작 기능 테스트 (실제 가능한 엔드포인트 사용)
   */
  async testSystemStart(userId = 1) {
    const testName = `SystemStart_User${userId}`;
    console.log(`🎯 [${testName}] 시작...`);

    try {
      // 1. 시스템 상태 확인
      const statusResult = await this.makeRequest('/api/system');

      // 2. 서버 생성 요청 (실제 가능한 엔드포인트)
      const startResult = await this.makeRequest('/api/servers/next', 'POST', {
        count: 1,
        serverType: 'web',
        userId: `test_user_${userId}`,
        timestamp: new Date().toISOString(),
      });

      // 3. 헬스체크
      const healthResult = await this.makeRequest('/api/health');

      const totalTime =
        statusResult.responseTime +
        startResult.responseTime +
        healthResult.responseTime;

      const result = {
        testName,
        userId,
        timestamp: new Date().toISOString(),
        success: startResult.statusCode === 200,
        totalResponseTime: totalTime,
        steps: {
          status: {
            time: statusResult.responseTime,
            code: statusResult.statusCode,
          },
          start: {
            time: startResult.responseTime,
            code: startResult.statusCode,
          },
          health: {
            time: healthResult.responseTime,
            code: healthResult.statusCode,
          },
        },
        details: {
          statusResponse: statusResult.data
            ? JSON.parse(statusResult.data)
            : null,
          startResponse: startResult.data ? JSON.parse(startResult.data) : null,
        },
      };

      this.results.systemStart.push(result);
      console.log(`✅ [${testName}] 완료 - ${totalTime}ms`);
      return result;
    } catch (error) {
      const errorResult = {
        testName,
        userId,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.error || error.message,
        responseTime: error.responseTime || 0,
      };

      this.results.errors.push(errorResult);
      console.log(`❌ [${testName}] 실패 - ${errorResult.error}`);
      return errorResult;
    }
  }

  /**
   * 📊 대시보드 데이터 플로우 테스트 (GET 기반)
   */
  async testDataGenerator(userId = 1, pattern = 'normal') {
    const testName = `DataGen_User${userId}_${pattern}`;
    console.log(`🎯 [${testName}] 시작...`);

    try {
      // 1. 기본 메트릭 데이터 조회
      const metricsResult = await this.makeRequest('/api/metrics');

      // 2. 서버 데이터 조회
      const typeResult = await this.makeRequest('/api/servers-unified?limit=5');

      // 3. 대시보드 데이터 확인
      const dashboardResult = await this.makeRequest('/api/monitoring/report');

      const totalTime =
        metricsResult.responseTime +
        typeResult.responseTime +
        dashboardResult.responseTime;

      const result = {
        testName,
        userId,
        pattern,
        timestamp: new Date().toISOString(),
        success:
          metricsResult.statusCode === 200 &&
          typeResult.statusCode === 200 &&
          dashboardResult.statusCode === 200,
        totalResponseTime: totalTime,
        steps: {
          metrics: {
            time: metricsResult.responseTime,
            code: metricsResult.statusCode,
          },
          type: { time: typeResult.responseTime, code: typeResult.statusCode },
          dashboard: {
            time: dashboardResult.responseTime,
            code: dashboardResult.statusCode,
          },
        },
        details: {
          metricsResponse: metricsResult.data
            ? JSON.parse(metricsResult.data)
            : null,
          typeResponse: typeResult.data ? JSON.parse(typeResult.data) : null,
          dashboardResponse: dashboardResult.data
            ? JSON.parse(dashboardResult.data)
            : null,
          dataType: pattern,
        },
      };

      this.results.dataGenerator.push(result);
      console.log(`✅ [${testName}] 완료 - ${totalTime}ms`);
      return result;
    } catch (error) {
      const errorResult = {
        testName,
        userId,
        pattern,
        timestamp: new Date().toISOString(),
        success: false,
        error: error.error || error.message,
        responseTime: error.responseTime || 0,
      };

      this.results.errors.push(errorResult);
      console.log(`❌ [${testName}] 실패 - ${errorResult.error}`);
      return errorResult;
    }
  }

  /**
   * 🔄 동시 사용자 시뮬레이션
   */
  async runConcurrentTest() {
    console.log(
      `\n🚀 동시 사용자 테스트 시작 (${this.concurrentUsers}명, ${this.testDuration}ms)`
    );
    console.log('=' * 60);

    const startTime = Date.now();
    const promises = [];

    // 동시 사용자 시뮬레이션
    for (let i = 1; i <= this.concurrentUsers; i++) {
      // 시스템 시작 테스트
      promises.push(this.testSystemStart(i));

      // 다양한 패턴으로 데이터 생성 테스트
      const patterns = ['normal', 'high-load', 'maintenance'];
      const pattern = patterns[i % patterns.length];
      promises.push(this.testDataGenerator(i, pattern));

      // 요청 간격 조절
      if (i % 3 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // 모든 테스트 완료 대기
    console.log(`⏳ ${promises.length}개 테스트 실행 중...`);
    await Promise.allSettled(promises);

    const endTime = Date.now();
    console.log(`\n✅ 모든 테스트 완료 - 총 ${endTime - startTime}ms\n`);
  }

  /**
   * 📈 결과 분석 및 리포트 생성
   */
  generateReport() {
    const systemStartSuccess = this.results.systemStart.filter(
      (r) => r.success
    );
    const dataGenSuccess = this.results.dataGenerator.filter((r) => r.success);
    const totalErrors = this.results.errors.length;

    // 응답 시간 통계
    const systemStartTimes = systemStartSuccess.map((r) => r.totalResponseTime);
    const dataGenTimes = dataGenSuccess.map((r) => r.totalResponseTime);

    const systemStartStats = this.calculateStats(systemStartTimes);
    const dataGenStats = this.calculateStats(dataGenTimes);

    const report = {
      summary: {
        totalTests:
          this.results.systemStart.length + this.results.dataGenerator.length,
        successfulTests: systemStartSuccess.length + dataGenSuccess.length,
        failedTests:
          this.results.systemStart.filter((r) => !r.success).length +
          this.results.dataGenerator.filter((r) => !r.success).length,
        errors: totalErrors,
        successRate: (
          ((systemStartSuccess.length + dataGenSuccess.length) /
            (this.results.systemStart.length +
              this.results.dataGenerator.length)) *
          100
        ).toFixed(2),
      },
      systemStart: {
        totalTests: this.results.systemStart.length,
        successful: systemStartSuccess.length,
        failed: this.results.systemStart.filter((r) => !r.success).length,
        responseTimeStats: systemStartStats,
      },
      dataGenerator: {
        totalTests: this.results.dataGenerator.length,
        successful: dataGenSuccess.length,
        failed: this.results.dataGenerator.filter((r) => !r.success).length,
        responseTimeStats: dataGenStats,
      },
      errors: this.results.errors,
    };

    this.results.summary = report;
    return report;
  }

  /**
   * 📊 통계 계산
   */
  calculateStats(values) {
    if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0 };

    const sorted = values.sort((a, b) => a - b);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }

  /**
   * 📋 리포트 출력
   */
  printReport() {
    const report = this.generateReport();

    console.log(`\n${'='.repeat(80)}`);
    console.log('🚀 OpenManager v5.7.4 부하 테스트 결과');
    console.log('='.repeat(80));

    console.log('\n📊 전체 요약:');
    console.log(`   총 테스트: ${report.summary.totalTests}개`);
    console.log(
      `   성공: ${report.summary.successfulTests}개 (${report.summary.successRate}%)`
    );
    console.log(`   실패: ${report.summary.failedTests}개`);
    console.log(`   에러: ${report.summary.errors}개`);

    console.log('\n🚀 시스템 시작 기능:');
    console.log(`   테스트 수: ${report.systemStart.totalTests}개`);
    console.log(
      `   성공률: ${((report.systemStart.successful / report.systemStart.totalTests) * 100).toFixed(1)}%`
    );
    console.log(
      `   응답시간: 최소 ${report.systemStart.responseTimeStats.min}ms, 평균 ${report.systemStart.responseTimeStats.avg}ms, 최대 ${report.systemStart.responseTimeStats.max}ms`
    );

    console.log('\n📊 데이터 생성 기능:');
    console.log(`   테스트 수: ${report.dataGenerator.totalTests}개`);
    console.log(
      `   성공률: ${((report.dataGenerator.successful / report.dataGenerator.totalTests) * 100).toFixed(1)}%`
    );
    console.log(
      `   응답시간: 최소 ${report.dataGenerator.responseTimeStats.min}ms, 평균 ${report.dataGenerator.responseTimeStats.avg}ms, 최대 ${report.dataGenerator.responseTimeStats.max}ms`
    );

    if (report.errors.length > 0) {
      console.log('\n❌ 발생한 에러들:');
      report.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.testName}] ${error.error}`);
      });
    }

    console.log(`\n${'='.repeat(80)}`);

    return report;
  }

  /**
   * 💾 결과를 JSON 파일로 저장
   */
  async saveResults() {
    const fs = require('node:fs').promises;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `load-test-results-${timestamp}.json`;

    try {
      await fs.writeFile(filename, JSON.stringify(this.results, null, 2));
      console.log(`\n💾 결과 저장됨: ${filename}`);
    } catch (error) {
      console.error(`❌ 결과 저장 실패: ${error.message}`);
    }
  }
}

/**
 * 🎯 메인 실행 함수
 */
async function main() {
  console.log('🚀 OpenManager v5.7.4 부하 테스트 시작');
  console.log('=' * 50);

  const tester = new LoadTester();

  try {
    // 서버 연결 확인
    console.log('🔍 서버 연결 확인 중...');
    await tester.makeRequest('/api/health');
    console.log('✅ 서버 연결 성공\n');

    // 동시 부하 테스트 실행
    await tester.runConcurrentTest();

    // 결과 분석 및 출력
    tester.printReport();

    // 결과 저장
    await tester.saveResults();
  } catch (error) {
    console.error(`❌ 테스트 실행 실패: ${error.message}`);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}

module.exports = LoadTester;
