import type { ServerStatusInfo } from '@/types/index';

// 🏢 기업 통합 IDC 인프라 - 30개 서버 구성
// 쿠버네티스 15대 + 온프레미스 15대

export const ENTERPRISE_SERVERS: ServerStatusInfo[] = [
  // 🐳 === KUBERNETES 클러스터 (15대) ===

  // K8s Control Plane - 마스터 노드 (3대 - HA 구성)
  {
    id: 'k8s-master-01',
    name: 'k8s-master-01.corp.local',
    status: 'error', // CRITICAL 장애
    lastUpdate: new Date(Date.now() - 120000).toISOString(), // 2분 전
    location: 'IDC-A 랙-01 (Control Plane #1)',
    uptime: 1728000, // 20일
    metrics: {
      cpu: 92.4,
      memory: 87.8,
      disk: 45.2,
      network: {
        bytesIn: 8388608, // 8MB/s
        bytesOut: 12582912, // 12MB/s
        packetsIn: 1500,
        packetsOut: 1200,
        latency: 85, // etcd 응답 지연
        connections: 245,
      },
      processes: 178,
      loadAverage: [2.15, 2.08, 1.95] as const,
    },
  },
  {
    id: 'k8s-master-02',
    name: 'k8s-master-02.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 30000).toISOString(),
    location: 'IDC-A 랙-02 (Control Plane #2)',
    uptime: 1728000,
    metrics: {
      cpu: 34.7,
      memory: 52.1,
      disk: 38.9,
      network: {
        bytesIn: 5242880,
        bytesOut: 7340032,
        packetsIn: 980,
        packetsOut: 850,
        latency: 12,
        connections: 156,
      },
      processes: 145,
      loadAverage: [0.65, 0.58, 0.42] as const,
    },
  },
  {
    id: 'k8s-master-03',
    name: 'k8s-master-03.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 45000).toISOString(),
    location: 'IDC-A 랙-03 (Control Plane #3)',
    uptime: 1728000,
    metrics: {
      cpu: 41.2,
      memory: 58.4,
      disk: 42.1,
      network: {
        bytesIn: 6291456,
        bytesOut: 8388608,
        packetsIn: 1100,
        packetsOut: 950,
        latency: 15,
        connections: 189,
      },
      processes: 152,
      loadAverage: [0.78, 0.65, 0.48] as const,
    },
  },

  // K8s Worker 노드 - 프론트엔드 워크로드 (4대)
  {
    id: 'k8s-worker-01',
    name: 'k8s-worker-01.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 25000).toISOString(),
    location: 'IDC-B 랙-01 (Frontend Workload)',
    uptime: 1296000, // 15일
    metrics: {
      cpu: 67.3,
      memory: 73.8,
      disk: 28.4,
      network: {
        bytesIn: 20971520, // 20MB/s
        bytesOut: 15728640, // 15MB/s
        packetsIn: 3200,
        packetsOut: 2800,
        latency: 8,
        connections: 324,
      },
      processes: 198,
      loadAverage: [1.12, 0.98, 0.85] as const,
    },
  },
  {
    id: 'k8s-worker-02',
    name: 'k8s-worker-02.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 35000).toISOString(),
    location: 'IDC-B 랙-02 (Frontend Workload)',
    uptime: 1296000,
    metrics: {
      cpu: 54.6,
      memory: 68.2,
      disk: 31.7,
      network: {
        bytesIn: 18874368,
        bytesOut: 14155776,
        packetsIn: 2900,
        packetsOut: 2500,
        latency: 10,
        connections: 287,
      },
      processes: 185,
      loadAverage: [0.89, 0.76, 0.62] as const,
    },
  },
  {
    id: 'k8s-worker-03',
    name: 'k8s-worker-03.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 40000).toISOString(),
    location: 'IDC-B 랙-03 (Frontend Workload)',
    uptime: 1296000,
    metrics: {
      cpu: 61.8,
      memory: 71.5,
      disk: 26.9,
      network: {
        bytesIn: 22020096,
        bytesOut: 16777216,
        packetsIn: 3400,
        packetsOut: 3000,
        latency: 7,
        connections: 356,
      },
      processes: 203,
      loadAverage: [1.05, 0.92, 0.78] as const,
    },
  },
  {
    id: 'k8s-worker-04',
    name: 'k8s-worker-04.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 50000).toISOString(),
    location: 'IDC-B 랙-04 (Frontend Workload)',
    uptime: 1296000,
    metrics: {
      cpu: 48.9,
      memory: 64.1,
      disk: 33.2,
      network: {
        bytesIn: 17825792,
        bytesOut: 13631488,
        packetsIn: 2700,
        packetsOut: 2300,
        latency: 9,
        connections: 267,
      },
      processes: 172,
      loadAverage: [0.72, 0.65, 0.58] as const,
    },
  },

  // K8s Worker 노드 - 백엔드 API 워크로드 (4대)
  {
    id: 'k8s-worker-05',
    name: 'k8s-worker-05.corp.local',
    status: 'warning', // 마스터 장애 영향
    lastUpdate: new Date(Date.now() - 90000).toISOString(),
    location: 'IDC-C 랙-01 (Backend API)',
    uptime: 864000, // 10일
    metrics: {
      cpu: 89.2,
      memory: 84.7,
      disk: 56.3,
      network: {
        bytesIn: 31457280, // 30MB/s
        bytesOut: 26214400, // 25MB/s
        packetsIn: 4800,
        packetsOut: 4200,
        latency: 45, // Pod 재시작으로 인한 지연
        connections: 412,
      },
      processes: 267,
      loadAverage: [1.78, 1.65, 1.52] as const,
    },
  },
  {
    id: 'k8s-worker-06',
    name: 'k8s-worker-06.corp.local',
    status: 'warning', // DB 마스터 장애 영향
    lastUpdate: new Date(Date.now() - 75000).toISOString(),
    location: 'IDC-C 랙-02 (Backend API)',
    uptime: 864000,
    metrics: {
      cpu: 82.1,
      memory: 79.3,
      disk: 52.8,
      network: {
        bytesIn: 28311552,
        bytesOut: 23068672,
        packetsIn: 4300,
        packetsOut: 3800,
        latency: 38,
        connections: 378,
      },
      processes: 245,
      loadAverage: [1.56, 1.42, 1.28] as const,
    },
  },
  {
    id: 'k8s-worker-07',
    name: 'k8s-worker-07.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 20000).toISOString(),
    location: 'IDC-C 랙-03 (Backend API)',
    uptime: 864000,
    metrics: {
      cpu: 72.4,
      memory: 68.9,
      disk: 41.5,
      network: {
        bytesIn: 25165824,
        bytesOut: 20971520,
        packetsIn: 3900,
        packetsOut: 3400,
        latency: 18,
        connections: 334,
      },
      processes: 218,
      loadAverage: [1.15, 1.02, 0.88] as const,
    },
  },
  {
    id: 'k8s-worker-08',
    name: 'k8s-worker-08.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 55000).toISOString(),
    location: 'IDC-C 랙-04 (Backend API)',
    uptime: 864000,
    metrics: {
      cpu: 65.7,
      memory: 71.2,
      disk: 38.9,
      network: {
        bytesIn: 23068672,
        bytesOut: 19922944,
        packetsIn: 3600,
        packetsOut: 3100,
        latency: 22,
        connections: 298,
      },
      processes: 201,
      loadAverage: [1.08, 0.95, 0.82] as const,
    },
  },

  // K8s Worker 노드 - 데이터 처리 및 배치 워크로드 (4대)
  {
    id: 'k8s-worker-09',
    name: 'k8s-worker-09.corp.local',
    status: 'warning', // 마스터 장애로 스케줄링 지연
    lastUpdate: new Date(Date.now() - 105000).toISOString(),
    location: 'IDC-D 랙-01 (Data Processing)',
    uptime: 432000, // 5일
    metrics: {
      cpu: 88.6,
      memory: 91.4,
      disk: 67.8,
      network: {
        bytesIn: 15728640,
        bytesOut: 12582912,
        packetsIn: 2400,
        packetsOut: 2000,
        latency: 52, // 스케줄링 지연
        connections: 198,
      },
      processes: 234,
      loadAverage: [1.89, 1.76, 1.63] as const,
    },
  },
  {
    id: 'k8s-worker-10',
    name: 'k8s-worker-10.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 30000).toISOString(),
    location: 'IDC-D 랙-02 (Data Processing)',
    uptime: 432000,
    metrics: {
      cpu: 76.3,
      memory: 82.1,
      disk: 58.4,
      network: {
        bytesIn: 13631488,
        bytesOut: 10485760,
        packetsIn: 2100,
        packetsOut: 1800,
        latency: 25,
        connections: 167,
      },
      processes: 198,
      loadAverage: [1.34, 1.21, 1.08] as const,
    },
  },
  {
    id: 'k8s-worker-11',
    name: 'k8s-worker-11.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 25000).toISOString(),
    location: 'IDC-D 랙-03 (Data Processing)',
    uptime: 432000,
    metrics: {
      cpu: 69.8,
      memory: 75.6,
      disk: 51.2,
      network: {
        bytesIn: 11534336,
        bytesOut: 9437184,
        packetsIn: 1800,
        packetsOut: 1500,
        latency: 19,
        connections: 145,
      },
      processes: 176,
      loadAverage: [1.18, 1.05, 0.92] as const,
    },
  },
  {
    id: 'k8s-worker-12',
    name: 'k8s-worker-12.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 40000).toISOString(),
    location: 'IDC-D 랙-04 (Data Processing)',
    uptime: 432000,
    metrics: {
      cpu: 62.1,
      memory: 68.9,
      disk: 46.7,
      network: {
        bytesIn: 10485760,
        bytesOut: 8388608,
        packetsIn: 1600,
        packetsOut: 1300,
        latency: 16,
        connections: 123,
      },
      processes: 158,
      loadAverage: [1.02, 0.89, 0.76] as const,
    },
  },

  // 🏢 === 온프레미스 서버 (15대) ===

  // 웹 서비스 계층 (4대)
  {
    id: 'web-lb-01',
    name: 'web-lb-01.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 20000).toISOString(),
    location: 'IDC-E 랙-01 (HAProxy LB #1)',
    uptime: 2592000, // 30일
    metrics: {
      cpu: 45.2,
      memory: 38.7,
      disk: 15.6,
      network: {
        bytesIn: 41943040, // 40MB/s
        bytesOut: 52428800, // 50MB/s
        packetsIn: 6400,
        packetsOut: 8000,
        latency: 5,
        connections: 1024,
      },
      processes: 89,
      loadAverage: [0.68, 0.52, 0.38] as const,
    },
  },
  {
    id: 'web-lb-02',
    name: 'web-lb-02.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 25000).toISOString(),
    location: 'IDC-E 랙-02 (HAProxy LB #2)',
    uptime: 2592000,
    metrics: {
      cpu: 42.8,
      memory: 36.2,
      disk: 18.3,
      network: {
        bytesIn: 39845888,
        bytesOut: 48234496,
        packetsIn: 6100,
        packetsOut: 7300,
        latency: 6,
        connections: 987,
      },
      processes: 85,
      loadAverage: [0.62, 0.48, 0.35] as const,
    },
  },
  {
    id: 'web-app-01',
    name: 'web-app-01.corp.local',
    status: 'warning', // DB 마스터 장애 영향
    lastUpdate: new Date(Date.now() - 85000).toISOString(),
    location: 'IDC-E 랙-03 (Legacy Web App #1)',
    uptime: 1728000, // 20일
    metrics: {
      cpu: 78.9,
      memory: 82.4,
      disk: 56.7,
      network: {
        bytesIn: 26214400,
        bytesOut: 20971520,
        packetsIn: 4000,
        packetsOut: 3200,
        latency: 150, // DB 대기로 인한 응답 지연
        connections: 456,
      },
      processes: 234,
      loadAverage: [1.45, 1.32, 1.18] as const,
    },
  },
  {
    id: 'web-app-02',
    name: 'web-app-02.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 35000).toISOString(),
    location: 'IDC-E 랙-04 (Legacy Web App #2)',
    uptime: 1728000,
    metrics: {
      cpu: 64.1,
      memory: 71.8,
      disk: 42.3,
      network: {
        bytesIn: 23068672,
        bytesOut: 18874368,
        packetsIn: 3500,
        packetsOut: 2900,
        latency: 25,
        connections: 389,
      },
      processes: 198,
      loadAverage: [1.12, 0.98, 0.85] as const,
    },
  },

  // 데이터베이스 계층 (4대)
  {
    id: 'db-master-01',
    name: 'db-master-01.corp.local',
    status: 'error', // CRITICAL 장애 - 장애 체인의 시작점
    lastUpdate: new Date(Date.now() - 180000).toISOString(), // 3분 전
    location: 'IDC-F 랙-01 (PostgreSQL Master)',
    uptime: 5184000, // 60일
    metrics: {
      cpu: 96.8, // CPU 과부하
      memory: 94.2, // 메모리 거의 가득
      disk: 89.7, // 디스크 I/O 100%
      network: {
        bytesIn: 67108864, // 64MB/s - 과도한 쿼리
        bytesOut: 31457280, // 30MB/s
        packetsIn: 10240,
        packetsOut: 4800,
        latency: 350, // 긴 쿼리 응답 시간
        connections: 850, // 커넥션 풀 거의 고갈
      },
      processes: 456,
      loadAverage: [3.45, 3.28, 3.15] as const,
    },
  },
  {
    id: 'db-slave-01',
    name: 'db-slave-01.corp.local',
    status: 'warning', // 마스터 장애로 읽기 부하 집중
    lastUpdate: new Date(Date.now() - 65000).toISOString(),
    location: 'IDC-F 랙-02 (PostgreSQL Slave #1)',
    uptime: 4320000, // 50일
    metrics: {
      cpu: 87.3, // 읽기 부하 집중
      memory: 79.6,
      disk: 67.4,
      network: {
        bytesIn: 15728640,
        bytesOut: 52428800, // 읽기 요청 급증
        packetsIn: 2400,
        packetsOut: 8000,
        latency: 85,
        connections: 567,
      },
      processes: 298,
      loadAverage: [1.89, 1.76, 1.63] as const,
    },
  },
  {
    id: 'db-slave-02',
    name: 'db-slave-02.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 40000).toISOString(),
    location: 'IDC-F 랙-03 (PostgreSQL Slave #2)',
    uptime: 4320000,
    metrics: {
      cpu: 72.8,
      memory: 68.4,
      disk: 54.2,
      network: {
        bytesIn: 12582912,
        bytesOut: 41943040,
        packetsIn: 1900,
        packetsOut: 6400,
        latency: 35,
        connections: 445,
      },
      processes: 234,
      loadAverage: [1.34, 1.21, 1.08] as const,
    },
  },
  {
    id: 'db-cache-01',
    name: 'db-cache-01.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 30000).toISOString(),
    location: 'IDC-F 랙-04 (Redis Cache)',
    uptime: 2160000, // 25일
    metrics: {
      cpu: 34.7,
      memory: 56.8,
      disk: 23.1,
      network: {
        bytesIn: 20971520,
        bytesOut: 25165824,
        packetsIn: 3200,
        packetsOut: 3800,
        latency: 8,
        connections: 234,
      },
      processes: 67,
      loadAverage: [0.52, 0.48, 0.35] as const,
    },
  },

  // 파일 및 스토리지 계층 (3대)
  {
    id: 'file-server-01',
    name: 'file-server-01.corp.local',
    status: 'warning', // 스토리지 서버 장애 영향
    lastUpdate: new Date(Date.now() - 95000).toISOString(),
    location: 'IDC-G 랙-01 (NFS File Server)',
    uptime: 6480000, // 75일
    metrics: {
      cpu: 58.2,
      memory: 67.9,
      disk: 78.4, // 파일 시스템 부하
      network: {
        bytesIn: 8388608,
        bytesOut: 16777216,
        packetsIn: 1300,
        packetsOut: 2600,
        latency: 45, // NFS 응답 지연
        connections: 167,
      },
      processes: 123,
      loadAverage: [1.15, 1.02, 0.88] as const,
    },
  },
  {
    id: 'backup-server-01',
    name: 'backup-server-01.corp.local',
    status: 'warning', // 스토리지 서버 장애로 백업 실패
    lastUpdate: new Date(Date.now() - 110000).toISOString(),
    location: 'IDC-G 랙-02 (Backup Server)',
    uptime: 7776000, // 90일
    metrics: {
      cpu: 72.6,
      memory: 84.1,
      disk: 92.3, // 백업 데이터 급증
      network: {
        bytesIn: 104857600, // 100MB/s - 백업 시도
        bytesOut: 2097152, // 2MB/s
        packetsIn: 16000,
        packetsOut: 320,
        latency: 120, // 백업 실패로 인한 재시도
        connections: 45,
      },
      processes: 89,
      loadAverage: [1.67, 1.54, 1.41] as const,
    },
  },
  {
    id: 'storage-server-01',
    name: 'storage-server-01.corp.local',
    status: 'error', // CRITICAL 장애 - 스토리지 병목
    lastUpdate: new Date(Date.now() - 150000).toISOString(), // 2.5분 전
    location: 'IDC-G 랙-03 (MinIO Storage)',
    uptime: 3456000, // 40일
    metrics: {
      cpu: 91.4,
      memory: 88.7,
      disk: 96.8, // 디스크 거의 가득
      network: {
        bytesIn: 125829120, // 120MB/s - I/O 병목
        bytesOut: 41943040, // 40MB/s
        packetsIn: 19200,
        packetsOut: 6400,
        latency: 280, // 파일 시스템 오류
        connections: 234,
      },
      processes: 167,
      loadAverage: [2.78, 2.65, 2.52] as const,
    },
  },

  // 인프라 서비스 계층 (4대)
  {
    id: 'monitor-server-01',
    name: 'monitor-server-01.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 15000).toISOString(),
    location: 'IDC-H 랙-01 (Prometheus+Grafana)',
    uptime: 1728000, // 20일
    metrics: {
      cpu: 56.8,
      memory: 73.2,
      disk: 45.6,
      network: {
        bytesIn: 31457280,
        bytesOut: 15728640,
        packetsIn: 4800,
        packetsOut: 2400,
        latency: 12,
        connections: 198,
      },
      processes: 145,
      loadAverage: [0.89, 0.76, 0.62] as const,
    },
  },
  {
    id: 'log-server-01',
    name: 'log-server-01.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 35000).toISOString(),
    location: 'IDC-H 랙-02 (ELK Stack)',
    uptime: 2592000, // 30일
    metrics: {
      cpu: 64.3,
      memory: 81.7,
      disk: 67.9,
      network: {
        bytesIn: 62914560, // 60MB/s - 로그 수집
        bytesOut: 10485760, // 10MB/s
        packetsIn: 9600,
        packetsOut: 1600,
        latency: 18,
        connections: 89,
      },
      processes: 198,
      loadAverage: [1.08, 0.95, 0.82] as const,
    },
  },
  {
    id: 'proxy-server-01',
    name: 'proxy-server-01.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 20000).toISOString(),
    location: 'IDC-H 랙-03 (Nginx Reverse Proxy)',
    uptime: 3888000, // 45일
    metrics: {
      cpu: 38.9,
      memory: 42.6,
      disk: 22.4,
      network: {
        bytesIn: 52428800, // 50MB/s
        bytesOut: 62914560, // 60MB/s
        packetsIn: 8000,
        packetsOut: 9600,
        latency: 7,
        connections: 567,
      },
      processes: 78,
      loadAverage: [0.58, 0.45, 0.32] as const,
    },
  },
  {
    id: 'dns-server-01',
    name: 'dns-server-01.corp.local',
    status: 'online',
    lastUpdate: new Date(Date.now() - 25000).toISOString(),
    location: 'IDC-H 랙-04 (Internal DNS)',
    uptime: 7776000, // 90일
    metrics: {
      cpu: 12.4,
      memory: 28.7,
      disk: 8.9,
      network: {
        bytesIn: 1048576, // 1MB/s
        bytesOut: 2097152, // 2MB/s
        packetsIn: 1600,
        packetsOut: 3200,
        latency: 3,
        connections: 234,
      },
      processes: 45,
      loadAverage: [0.18, 0.15, 0.12] as const,
    },
  },
];
