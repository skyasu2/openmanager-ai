
import { metricsProvider } from '../src/services/metrics/MetricsProvider';
import { PrometheusTransformer } from '../src/services/metrics/PrometheusTransformer';

async function main() {
  console.log('🚀 Testing PrometheusTransformer...');

  // 1. Get current metrics
  const metrics = metricsProvider.getAllServerMetrics();
  console.log(`Getting metrics for ${metrics.length} servers...`);

  if (metrics.length === 0) {
    console.error('❌ No metrics found, cannot test transformer.');
    return;
  }

  // 2. Transform to Prometheus Vector (Instant Query)
  const vectorResponse = PrometheusTransformer.transformToVector(metrics, 'cpu');
  
  if (vectorResponse.status === 'success' && vectorResponse.data.resultType === 'vector') {
    console.log('✅ Successfully transformed to Prometheus Vector format!');
    console.log(`   Result count: ${vectorResponse.data.result.length}`);
    const first = vectorResponse.data.result[0];
    console.log('   Sample:', JSON.stringify(first, null, 2));
  } else {
    console.error('❌ Failed to transform to vector format:', vectorResponse);
  }

  // 3. Test with Prometheus-specific metric name
  const memTotalResponse = PrometheusTransformer.transformToVector(metrics, 'node_memory_MemTotal_bytes');
  if (memTotalResponse.status === 'success') {
     console.log('✅ Successfully mapped node_memory_MemTotal_bytes');
     console.log('   Sample:', JSON.stringify(memTotalResponse.data.result[0], null, 2));
  }
}

main().catch(console.error);
