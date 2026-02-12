
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Embed metric generation logic directly to avoid module resolution issues in script
// This is a self-contained script to avoid 'module not found' errors with tsx
// ==========================================

export type MetricType = 'cpu' | 'memory' | 'disk' | 'network';
export type Severity = 'normal' | 'warning' | 'critical';
export type Pattern = 'spike' | 'gradual' | 'oscillate' | 'sustained';

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  timeRange: [number, number];
  serverId: string;
  affectedMetric: MetricType;
  severity: Severity;
  pattern: Pattern;
  baseValue: number;
  peakValue: number;
}

export const FAILURE_SCENARIOS: ScenarioDefinition[] = [
  { id: 'dawn-backup', name: '새벽 백업 디스크 사용 급증', description: '매일 새벽 2시-4시에 실행되는 자동 백업으로 디스크 I/O 급증', timeRange: [120, 240], serverId: 'DB-MAIN-01', affectedMetric: 'disk', severity: 'warning', pattern: 'gradual', baseValue: 50, peakValue: 95 },
  { id: 'morning-peak-cpu', name: '출근 시간대 CPU 스파이크', description: '오전 8-9시 출근 시간대 사용자 접속 폭주로 웹 서버 CPU 급증', timeRange: [480, 540], serverId: 'WEB-01', affectedMetric: 'cpu', severity: 'warning', pattern: 'spike', baseValue: 30, peakValue: 85 },
  { id: 'lunch-memory-oscillate', name: '점심 시간 메모리 진동', description: '12-13시 점심 주문 앱 사용 증가로 메모리 사용량 진동', timeRange: [720, 780], serverId: 'APP-01', affectedMetric: 'memory', severity: 'normal', pattern: 'oscillate', baseValue: 60, peakValue: 80 },
  { id: 'storage-warning', name: '오후 디스크 경고', description: '17-18시 로그 파일 누적으로 스토리지 서버 디스크 경고', timeRange: [1020, 1080], serverId: 'STORAGE-01', affectedMetric: 'disk', severity: 'warning', pattern: 'sustained', baseValue: 75, peakValue: 88 },
  { id: 'evening-network-critical', name: '저녁 네트워크 폭주', description: '20-22시 저녁 피크 타임 네트워크 트래픽 폭주 (심각)', timeRange: [1200, 1320], serverId: 'WEB-03', affectedMetric: 'network', severity: 'critical', pattern: 'oscillate', baseValue: 40, peakValue: 92 },
  { id: 'night-memory-leak', name: '야간 메모리 누수', description: '23시대 메모리 누수로 인한 APP-02 서버 메모리 급증 (심각)', timeRange: [1380, 1439], serverId: 'APP-02', affectedMetric: 'memory', severity: 'critical', pattern: 'spike', baseValue: 70, peakValue: 92 },
];

function applyScenario(serverId: string, metric: MetricType, minuteOfDay: number, baseValue: number): number {
  const scenario = FAILURE_SCENARIOS.find(s => s.serverId === serverId && s.affectedMetric === metric && minuteOfDay >= s.timeRange[0] && minuteOfDay <= s.timeRange[1]);
  if (!scenario) return baseValue;
  const [start, end] = scenario.timeRange;
  const duration = end - start;
  const elapsed = minuteOfDay - start;
  const progress = elapsed / duration;
  let value = baseValue;
  switch (scenario.pattern) {
    case 'spike': value = progress < 0.2 ? baseValue + (scenario.peakValue - baseValue) * (progress / 0.2) : scenario.peakValue; break;
    case 'gradual': value = baseValue + (scenario.peakValue - baseValue) * progress; break;
    case 'oscillate': value = (baseValue + (scenario.peakValue - baseValue) / 2) + ((scenario.peakValue - baseValue) / 2) * Math.sin(progress * Math.PI * 4); break;
    case 'sustained': value = scenario.peakValue; break;
  }
  return Math.max(0, Math.min(100, value));
}

export interface Fixed10MinMetric {
  minuteOfDay: number;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  logs: string[];
}

export interface Server24hDataset {
  serverId: string;
  serverType: string;
  location: string;
  baseline: { cpu: number; memory: number; disk: number; network: number };
  data: Fixed10MinMetric[];
}

function generateLogs(serverId: string, serverType: string, cpu: number, memory: number, disk: number, network: number, activeScenario?: ScenarioDefinition): string[] {
  const logs: string[] = [];
  if (activeScenario) {
    if (activeScenario.severity === 'critical') {
      logs.push(`[CRITICAL] ${activeScenario.name} detected on ${serverId}`);
      logs.push(`[ERROR] ${activeScenario.affectedMetric.toUpperCase()} usage exceeded critical threshold (${activeScenario.peakValue}%)`);
      if (activeScenario.affectedMetric === 'network') logs.push(`[NET] Packet loss rate high: 15.4%`);
      if (activeScenario.affectedMetric === 'memory') logs.push(`[MEM] OOM Killer invoked, active processes terminated`);
    } else if (activeScenario.severity === 'warning') {
      logs.push(`[WARN] ${activeScenario.name} - Pattern suspicious`);
      logs.push(`[INFO] Monitoring agent triggered alert for ${activeScenario.affectedMetric}`);
    }
  }
  if (cpu > 80) logs.push(`[WARN] High CPU load: ${cpu.toFixed(1)}%`);
  if (memory > 85) logs.push(`[WARN] Available memory low: ${(100 - memory).toFixed(1)}% free`);
  if (disk > 90) logs.push(`[WARN] Disk space running low on /dev/sda1`);
  if (network > 80) logs.push(`[WARN] Network interface eth0 saturation: ${network.toFixed(1)}%`);
  if (logs.length === 0) {
    const normalLogs = [`[INFO] Health check passed - latency 4ms`, `[INFO] Job scheduler active, 0 pending jobs`, `[INFO] Database connection pool stable (active: 12, idle: 48)`, `[INFO] System metrics collection successful`, `[INFO] Access log rotation completed`];
    const randomLog = normalLogs[Math.floor(Math.random() * normalLogs.length)];
    if (randomLog) logs.push(randomLog);
  }
  return logs;
}

function addVariation(value: number): number {
  const variation = value * (Math.random() - 0.5) * 0.1;
  return Math.max(0, Math.min(100, value + variation));
}

function generateServer24hData(serverId: string, serverType: string, location: string, baseline: { cpu: number; memory: number; disk: number; network: number }): Server24hDataset {
  const data: Fixed10MinMetric[] = [];
  for (let i = 0; i < 144; i++) {
    const minuteOfDay = i * 10;
    let cpu = addVariation(baseline.cpu);
    let memory = addVariation(baseline.memory);
    let disk = addVariation(baseline.disk);
    let network = addVariation(baseline.network);
    const activeScenario = FAILURE_SCENARIOS.find(s => s.serverId === serverId && minuteOfDay >= s.timeRange[0] && minuteOfDay <= s.timeRange[1]);
    if (activeScenario) {
        cpu = applyScenario(serverId, 'cpu', minuteOfDay, cpu);
        memory = applyScenario(serverId, 'memory', minuteOfDay, memory);
        disk = applyScenario(serverId, 'disk', minuteOfDay, disk);
        network = applyScenario(serverId, 'network', minuteOfDay, network);
    }
    const logs = generateLogs(serverId, serverType, cpu, memory, disk, network, activeScenario);
    data.push({ minuteOfDay, cpu: Math.round(cpu * 10) / 10, memory: Math.round(memory * 10) / 10, disk: Math.round(disk * 10) / 10, network: Math.round(network * 10) / 10, logs });
  }
  return { serverId, serverType, location, baseline, data };
}

const FIXED_24H_DATASETS: Server24hDataset[] = [
  generateServer24hData('WEB-01', 'web', 'Seoul-AZ1', { cpu: 30, memory: 45, disk: 25, network: 50 }),
  generateServer24hData('WEB-02', 'web', 'Seoul-AZ2', { cpu: 35, memory: 50, disk: 30, network: 55 }),
  generateServer24hData('WEB-03', 'web', 'Busan-AZ1', { cpu: 40, memory: 55, disk: 35, network: 40 }),
  generateServer24hData('DB-MAIN-01', 'database', 'Seoul-AZ1', { cpu: 50, memory: 70, disk: 50, network: 45 }),
  generateServer24hData('DB-REPLICA-01', 'database', 'Seoul-AZ2', { cpu: 40, memory: 65, disk: 48, network: 40 }),
  generateServer24hData('DB-BACKUP-01', 'database', 'Busan-AZ1', { cpu: 25, memory: 50, disk: 60, network: 30 }),
  generateServer24hData('APP-01', 'application', 'Seoul-AZ1', { cpu: 45, memory: 60, disk: 40, network: 50 }),
  generateServer24hData('APP-02', 'application', 'Seoul-AZ2', { cpu: 50, memory: 70, disk: 45, network: 55 }),
  generateServer24hData('APP-03', 'application', 'Busan-AZ1', { cpu: 55, memory: 75, disk: 50, network: 60 }),
  generateServer24hData('STORAGE-01', 'storage', 'Seoul-AZ1', { cpu: 20, memory: 40, disk: 75, network: 35 }),
  generateServer24hData('STORAGE-02', 'storage', 'Busan-AZ1', { cpu: 25, memory: 45, disk: 70, network: 40 }),
  generateServer24hData('CACHE-01', 'cache', 'Seoul-AZ1', { cpu: 35, memory: 80, disk: 20, network: 60 }),
  generateServer24hData('CACHE-02', 'cache', 'Seoul-AZ2', { cpu: 40, memory: 85, disk: 25, network: 65 }),
  generateServer24hData('LB-01', 'loadbalancer', 'Seoul-AZ1', { cpu: 30, memory: 50, disk: 15, network: 70 }),
  generateServer24hData('LB-02', 'loadbalancer', 'Seoul-AZ2', { cpu: 35, memory: 55, disk: 20, network: 75 }),
];

// ==========================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase Credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedLogs() {
  console.log('🚀 Seeding Fixed Logs to Supabase (Self-Contained)...');

  interface LogEntry {
    server_id: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
    source: string;
    created_at: string;
  }
  const logsToInsert: LogEntry[] = [];
  const today = new Date().toISOString().split('T')[0];

  for (const dataset of FIXED_24H_DATASETS) {
    for (const metric of dataset.data) {
        if (metric.logs && metric.logs.length > 0) {
            const minuteOfDay = metric.minuteOfDay;
            const hours = Math.floor(minuteOfDay / 60);
            const minutes = minuteOfDay % 60;
            const timestamp = new Date(`${today}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00Z`).toISOString();

            for (const logMsg of metric.logs) {
                let level: 'info' | 'warn' | 'error' = 'info';
                if (logMsg.includes('[CRITICAL]') || logMsg.includes('[ERROR]')) level = 'error';
                else if (logMsg.includes('[WARN]')) level = 'warn';

                logsToInsert.push({
                    server_id: dataset.serverId,
                    level,
                    message: logMsg,
                    timestamp: timestamp,
                    source: 'system-monitor',
                    created_at: new Date().toISOString()
                });
            }
        }
    }
  }

  console.log(`📦 Prepared ${logsToInsert.length} log entries.`);

  let insertedCount = 0;
  let skippedCount = 0;
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < logsToInsert.length; i += BATCH_SIZE) {
    const batch = logsToInsert.slice(i, i + BATCH_SIZE);
    
    // Attempt Upsert with onConflict for duplicate prevention
    // Assuming a unique constraint or index exists or using simple check-insert fallback
    
    const { error } = await supabase
        .from('server_logs')
        .upsert(batch, { 
            onConflict: 'server_id, timestamp, message', 
            ignoreDuplicates: true 
        });

    if (error) {
         // Fallback: Check & Insert one by one (Ensures no duplicates)
        for (const log of batch) {
            const { data: existing } = await supabase
                .from('server_logs')
                .select('id')
                .eq('server_id', log.server_id)
                .eq('timestamp', log.timestamp)
                .eq('message', log.message)
                .maybeSingle(); // Use maybeSingle to avoid 406 error if multiple found
            
            if (!existing) {
                await supabase.from('server_logs').insert(log);
                insertedCount++;
            } else {
                skippedCount++;
            }
        }
    } else {
        // Upsert successful (or ignored duplicates)
        insertedCount += batch.length; // Approximate, as some might have been ignored
    }
    
    process.stdout.write(`\r⏳ Processing... ${i + batch.length}/${logsToInsert.length}`);
  }

  console.log('\n');
  console.log(`✅ Seed Completed: ${insertedCount} inserted/processed, ${skippedCount} items skipped manually.`);
}

seedLogs();
