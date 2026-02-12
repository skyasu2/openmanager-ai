
import { metricsProvider } from '../src/services/metrics/MetricsProvider';

async function main() {
  console.log('🚀 Testing MetricsProvider with OTLP Standard Data...');

  const timeInfo = metricsProvider.getTimeInfo();
  console.log('⏰ Time Info:', timeInfo);

  console.log('🔄 Fetching all server metrics...');
  const start = performance.now();
  const metrics = metricsProvider.getAllServerMetrics();
  const end = performance.now();

  console.log(`✅ Fetched ${metrics.length} server metrics in ${(end - start).toFixed(2)}ms`);

  if (metrics.length > 0) {
    const first = metrics[0];
    console.log('📊 First Server Metrics Sample:');
    console.log('   ServerID:', first.serverId);
    console.log('   Hostname:', first.hostname);
    console.log('   Status:', first.status);
    console.log('   CPU:', first.cpu, '%');
    console.log('   Memory:', first.memory, '%');
    console.log('   Disk:', first.disk, '%');
    console.log('   Network:', first.network);
    console.log('   OTel Resource:', JSON.stringify(first.otelResource, null, 2));
  } else {
    console.error('❌ No metrics found! Check data files.');
  }
}

main().catch(console.error);
