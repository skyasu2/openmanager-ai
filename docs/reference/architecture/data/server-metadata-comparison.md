# 서버 등록 메타데이터 비교 분석: OpenManager AI vs 상용 모니터링 도구

> 서버 등록 메타데이터 범위/깊이를 상용 도구와 비교한 분석 문서
> Owner: platform-data
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-02-14
> Canonical: docs/reference/architecture/data/server-metadata-comparison.md
> Tags: server,metadata,comparison,data
>
> **작성일**: 2026-02-12
> **대상 버전**: OpenManager AI v8.0.0
> **목적**: 서버 등록/정의 시 수집하는 메타데이터가 상용 모니터링 도구 대비 어떤 수준인지 비교 분석
> **범위**: 호스트 인벤토리(등록 시점 정적 메타데이터) 중심, 런타임 메트릭은 참고 수준

> **관련 문서** (본 문서와 상호 보완적):
> - `prometheus-comparison.md` — Prometheus best practice vs VIBE 메트릭 네이밍/모델 비교
> - `data-pipeline-comparison.md` — Custom JSON → Prometheus 포맷 전환 전후 비교
> - `otel-data-architecture.md` — OTel 데이터 아키텍처 (파이프라인 + 전환 준비)

---

## 1. OpenManager AI 현재 수집 항목 정리

코드베이스 탐색 결과, 서버 메타데이터는 **3개 레이어**에 걸쳐 정의된다.

### 1.1 데이터 소스별 필드 맵

#### Layer 1: ServerConfig (데이터 생성 시점)

> 소스: `scripts/data/sync-hourly-data.ts` lines 57-77

```typescript
interface ServerConfig {
  id: string;           // 'web-nginx-icn-01'
  name: string;         // 'Nginx Web Server 01'
  type: ServerType;     // 'web' | 'database' | 'application' | 'storage' | 'cache' | 'loadbalancer'
  location: string;     // 'Seoul-ICN-AZ1'
  hostname: string;     // 'web-nginx-icn-01.openmanager.kr'
  ip: string;           // '10.10.1.11'
  os: string;           // 'ubuntu'
  osVersion: string;    // '22.04'
  specs: {
    cpu_cores: number;  // 4
    memory_gb: number;  // 8
    disk_gb: number;    // 100
  };
  baseline: {           // 시뮬레이션용 기준값
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}
```

**필드 수**: 13개 (baseline 4개 포함)

#### Layer 2: Prometheus 타겟 라벨 (hourly-data JSON)

> 소스: `src/data/hourly-data/hour-XX.json`

```json
{
  "instance": "web-nginx-icn-01:9100",
  "job": "node-exporter",
  "labels": {
    "hostname": "web-nginx-icn-01.openmanager.kr",
    "datacenter": "Seoul-ICN-AZ1",
    "environment": "production",
    "server_type": "web",
    "os": "ubuntu",
    "os_version": "22.04"
  },
  "nodeInfo": {
    "cpu_cores": 4,
    "memory_total_bytes": 8589934592,
    "disk_total_bytes": 107374182400
  }
}
```

**필드 수**: 11개 (instance, job, labels 6개, nodeInfo 3개)

#### Layer 3: OTel Resource Attributes (resource-catalog.json)

> 소스: `src/data/otel-processed/resource-catalog.json`

```json
{
  "service.name": "openmanager-ai",
  "host.name": "web-nginx-icn-01.openmanager.kr",
  "host.id": "web-nginx-icn-01",
  "host.type": "web",
  "os.type": "ubuntu",
  "os.description": "ubuntu 22.04",
  "cloud.region": "kr-seoul",
  "cloud.availability_zone": "Seoul-ICN-AZ1",
  "deployment.environment": "production",
  "host.cpu.count": 4,
  "host.memory.size": 8589934592,
  "host.disk.size": 107374182400
}
```

**필드 수**: 12개

### 1.2 TypeScript 타입 시스템 (UI/API 소비 측)

> 소스: `src/types/server/core.ts`, `entities.ts`, `base.ts`, `metrics.ts`

| 인터페이스 | 용도 | 메타데이터 필드 |
|-----------|------|---------------|
| `Server` | 기본 서버 | id, name, hostname, status, type, environment, provider, role, os, ip, location, description |
| `ServerInstance` | 대시보드 확장 | + region, version, tags[], provider |
| `EnhancedServerMetrics` | AI 교차검증 | + metadata.serverType, metadata.timeSlot, trends |
| `ServerSnapshot` | Cloud Run AI용 | id, name, type, status (메트릭만, 메타 최소화) |
| `ServerMetadata` | 엔티티 | id, ip, name, location, os, type, isActive, processes[] |
| `NetworkInfo` | 네트워크 | interface, receivedBytes, sentBytes, receivedErrors, sentErrors |
| `SystemInfo` | 시스템 | os, uptime, processes, zombieProcesses, loadAverage |
| `ProcessInfo` | 프로세스 | pid, name, cpu, memory, user |

### 1.3 런타임 메트릭 (참고)

> 소스: `src/data/hourly-data/hour-XX.json` → metrics 블록

| 메트릭명 | 단위 | 비고 |
|---------|------|------|
| `node_cpu_usage_percent` | % | 전체 CPU 사용률 |
| `node_memory_usage_percent` | % | 메모리 사용률 |
| `node_filesystem_usage_percent` | % | 디스크 사용률 |
| `node_network_transmit_bytes_rate` | bytes/s | 네트워크 전송률 |
| `node_load1` | - | 1분 로드 평균 |
| `node_load5` | - | 5분 로드 평균 |
| `node_boot_time_seconds` | Unix ts | 부팅 시간 |
| `node_procs_running` | count | 실행 프로세스 수 |
| `node_http_request_duration_milliseconds` | ms | HTTP 응답 시간 |
| `up` | 0/1 | 가용성 |

### 1.4 종합: 고유 필드 카운트

| 카테고리 | 필드 수 | 주요 필드 |
|---------|:-------:|----------|
| Identity & Naming | 5 | id, name, hostname, ip, service.name |
| Server Type & Role | 4 | type (6종), server_type, host.type, role |
| Location & Infra | 6 | location, datacenter, cloud.region, cloud.availability_zone, environment, deployment.environment |
| Hardware Specs | 6 | cpu_cores, memory_gb/bytes, disk_gb/bytes (3가지 표현 × 2 단위) |
| OS Info | 4 | os, osVersion, os.type, os.description |
| Prometheus Labels | 8 | instance, job + labels 6개 |
| OTel Resource | 12 | host.*, os.*, cloud.*, service.*, deployment.* |
| Runtime Metrics | 10 | cpu, memory, disk, network, load, boot_time, procs, response_time, up |
| **중복 제거 합계** | **~40** | 3개 레이어 간 상당수 중복 (hostname, os, type 등) |

---

## 2. 상용 도구별 수집 항목 비교 매트릭스

### 2.1 호스트 등록/인벤토리 필드 횡단 비교

| 카테고리 | OpenManager AI | Datadog | Prometheus | New Relic | Zabbix | CloudWatch | Elastic (ECS) |
|---------|:-------------:|:-------:|:----------:|:---------:|:------:|:----------:|:-------------:|
| **Identity** | | | | | | | |
| hostname / FQDN | hostname | hostname, fqdn | instance label | hostname, fullHostname | host, name, dns | InstanceId, hostname | host.hostname, host.name |
| Instance ID | id (custom) | host_id, aws.instance_id | — | entityGuid | hostid (auto) | InstanceId | host.id |
| Agent version | — | agent_version, gohai_version | — | agentVersion | agent.version | agent_version | agent.version |
| Alias / Display | name | host_aliases[] | — | — | visible_name | — | host.name |
| **Hardware: CPU** | | | | | | | |
| Core count | cpu_cores | gohai.cpu.cpu_cores | node_cpu_info (count) | processorCount, coreCount | — | — | host.cpu.usage (런타임만) |
| CPU model | — | gohai.cpu.model_name | node_cpu_info{model} | — | hw.cpu.model (inv) | — | — |
| CPU frequency | — | gohai.cpu.mhz | node_cpu_frequency_max_hertz | — | hw.cpu.cur_freq (inv) | — | — |
| CPU vendor | — | gohai.cpu.vendor_id | node_cpu_info{vendor} | — | hw.cpu.vendor (inv) | — | — |
| CPU architecture | — | gohai.cpu.family | node_uname_info{machine} | — | hw.arch (inv) | architecture | host.architecture |
| Cache size | — | gohai.cpu.cache_size | — | — | hw.cpu.cache (inv) | — | — |
| **Hardware: Memory** | | | | | | | |
| Total | memory_gb/bytes | gohai.memory.total | node_memory_MemTotal_bytes | memoryTotalBytes | — (런타임) | — | host.memory.size (런타임) |
| Free | — | — (런타임) | node_memory_MemFree_bytes | memoryFreeBytes | — | — | — |
| Swap total | — | gohai.memory.swap_total | node_memory_SwapTotal_bytes | swapTotalBytes | — | — | — |
| Swap free | — | — (런타임) | node_memory_SwapFree_bytes | swapFreeBytes | — | — | — |
| **Hardware: Disk** | | | | | | | |
| Total capacity | disk_gb/bytes | gohai.filesystem[] | node_filesystem_size_bytes | diskTotalBytes | — | — | — |
| Device name | — | gohai.filesystem.name | {device} label | device | — | — | — |
| Mount point | — | gohai.filesystem.mounted_on | {mountpoint} label | mountPoint | — | — | — |
| FS type | — | — | {fstype} label | filesystemType | — | — | — |
| IOPS | — | — (런타임) | node_disk_reads/writes_completed | — (런타임) | — | DiskReadOps | — |
| **Hardware: Network** | | | | | | | |
| IP addresses | ip (단일) | host_ip, gohai.network.ipaddress | — | ipV4Address, ipV6Address | host_ip, interfaces[] | PrivateIpAddress, PublicIp | host.ip[] |
| MAC address | — | gohai.network.macaddress | — | hardwareAddress | interfaces[].mac | MacAddress | host.mac[] |
| Interface name | — | gohai.network.interfaces[] | {device} label | interfaceName | interfaces[].if | NetworkInterfaceId | — |
| Duplex / Speed | — | — | node_network_speed_bytes | — | interfaces[].speed | — | — |
| **OS Info** | | | | | | | |
| OS name | os | gohai.platform.os | node_uname_info{sysname} | operatingSystem | host_os, os.type | PlatformDetails | host.os.name |
| OS version | osVersion | gohai.platform.os_version | node_os_version | windowsVersion / linuxDistribution | host_os_version | — | host.os.version |
| Kernel version | — | gohai.platform.kernel_version | node_uname_info{release} | kernelVersion | system.kernel.* | — | host.os.kernel |
| Architecture | — | gohai.platform.processor | node_uname_info{machine} | — | — | architecture | host.architecture |
| **Cloud Metadata** | | | | | | | |
| Provider | — (타입 추론) | cloud_provider | — | cloud.provider (OTel) | — | (implicit: AWS) | cloud.provider |
| Region | cloud.region | region, availability_zone | — | region | — | Region | cloud.region |
| AZ | cloud.availability_zone | availability-zone | — | zone | — | AvailabilityZone | cloud.availability_zone |
| Instance type | — | instance-type | — | instanceType | — | InstanceType | cloud.machine.type |
| Account / Project | — | account_id | — | accountId | — | AccountId | cloud.account.id |
| Image / AMI | — | ami-id | — | ec2.ami_id | — | ImageId | cloud.image.id |
| VPC / Subnet | — | vpc_id, subnet_id | — | — | — | VpcId, SubnetId | — |
| Security Groups | — | security-groups | — | — | — | SecurityGroups[] | — |
| **Organizational** | | | | | | | |
| Tags / Labels | tags[] (타입만) | tags{} (무제한) | labels{} (타겟) | tags{}, custom attributes | tags[], host groups | Tags{} | labels{} |
| Team / Owner | — | team tag (관행) | — | — | — | — | — |
| Contact / POC | — | — | — | — | poc_1/2_*, site_* (inv) | — | — |
| Contract / SLA | — | — | — | — | contract_*, hw_* (inv) | — | — |
| Lifecycle dates | — | — | — | — | date_hw_purchase/install/decomm | — | — |
| **Auto-Discovery** | | | | | | | |
| Process list | procs_running (수만) | process agent (full) | node_processes_* | ProcessSample (full) | proc.* | — | process.* |
| Open ports | — | network.connections | — | — | net.tcp.listen | — | — |
| Container info | — | container.* (full) | — | ContainerSample | docker.* | — | container.* |
| Service discovery | — | apm, auto-discovery | file_sd, dns_sd, consul_sd... | APM auto-instrument | LLD (discovery rules) | — | — |
| **Physical Location** | | | | | | | |
| Latitude / Longitude | — | — | — | — | location_lat/lon | — | host.geo.location |
| Rack / Row / Floor | — | — | — | — | site_rack, hw_*, location | — | — |
| Address / Site | — | — | — | — | site_address_*, site_city | — | host.geo.city_name, country |

### 2.2 필드 카운트 요약

| 도구 | 등록 시점 정적 필드 | 런타임 포함 | 자동 발견 |
|------|:------------------:|:----------:|:---------:|
| **Zabbix** | 71 (inventory) | +수백 | LLD rules |
| **Datadog** | ~50 (gohai + cloud) | +수천 | APM, containers |
| **New Relic** | ~40 (5 event types) | +수백 | APM, Flex |
| **Elastic (ECS)** | ~70 (host+os+cloud+geo+agent+container) | +수백 | Processors |
| **CloudWatch** | ~50 (IMDS v2) | +수백 | AWS native |
| **Prometheus** | ~40 (labels + info metrics + DMI) | +수천 (60+ collectors) | SD mechanisms |
| **OpenManager AI** | **~40** (3 layers 합산) | +10 | 없음 (정적 JSON) |

---

## 3. GAP 분석: OpenManager AI에 없는 것

### 3.1 주요 갭 상세

| # | 갭 카테고리 | 상용 도구에서 일반적인 것 | OpenManager AI 현재 | 영향도 |
|:-:|-----------|----------------------|-------------------|:-----:|
| 1 | **CPU 상세** | model, frequency, vendor, architecture, cache | `cpu_cores` 수만 존재 | 중 |
| 2 | **메모리 상세** | free, available, cached, buffers, swap total/free | total + usage% 만 | 중 |
| 3 | **디스크 장치별** | 마운트포인트별 용량, FS 타입, device 이름, IOPS | 전체 usage% 만 | 높음 |
| 4 | **NIC 상세** | 인터페이스별 stats, duplex, speed, errors, MAC | 전체 network rate 단일 값 | 중 |
| 5 | **커널 정보** | kernel version, architecture, boot UUID | 없음 | 낮음 |
| 6 | **Agent 정보** | agent version, build info, update time | 없음 (시뮬레이션이므로) | 낮음 |
| 7 | **클라우드 상세** | instance type, VPC, SG, AMI, account ID | region/AZ만 존재 | 중 |
| 8 | **조직 정보** | team, owner, contact, contract, lifecycle dates | 없음 | 낮음 |
| 9 | **프로세스 상세** | PID, name, cmdline, CPU/mem per process, user | `procs_running` 카운트만 | 중 |
| 10 | **컨테이너** | container ID, image, labels, runtime | 없음 | 낮음 |
| 11 | **물리 위치** | 랙, 층, 좌표, 사이트 주소 | datacenter 이름만 | 낮음 |
| 12 | **자동 발견** | service discovery, auto-registration, LLD | 없음 (정적 JSON 15대) | 높음 |

### 3.2 갭 vs 설계 의도

OpenManager AI는 **시뮬레이션 플랫폼**이다. 실제 서버에서 에이전트가 수집하는 것이 아니라 `sync-hourly-data.ts`에서 PRNG 기반으로 데이터를 생성한다.

따라서 위 갭 중 상당수는 **의도적 생략**이다:

| 분류 | 갭 항목 | 이유 |
|------|--------|------|
| **의도적 생략** | Agent version, 자동 발견, 컨테이너 | 에이전트가 없으므로 해당 없음 |
| **현실적 생략** | 조직 정보, 물리 위치 상세, 라이프사이클 | 데모/학습 플랫폼에서 불필요 |
| **확장 가치 있음** | CPU model, 메모리 상세, 디스크 장치별, NIC별, 클라우드 상세 | 시뮬레이션 리얼리즘 향상 + AI 분석 품질 향상 |

---

## 4. 도구별 특화 영역 분석

### 4.1 Zabbix — 물리 인벤토리의 왕

Zabbix는 호스트 인벤토리에 **71개 정적 필드**를 제공하며, 이는 모든 모니터링 도구 중 가장 풍부하다.

**특화 필드 (다른 도구에 없는 것)**:
- 하드웨어: `hw_arch`, `chassis`, `model`, `serialno_a/b`, `tag`
- 연락처: `poc_1_name/email/phone/cell/screen`, `poc_2_*`
- 계약: `contract_number`, `installer_name`, `date_hw_purchase/install/decomm`
- 위치: `site_address_a/b/c`, `site_city`, `site_state`, `site_zip`, `site_rack`, `site_notes`
- 소프트웨어: `software`, `software_full`, `software_app_a/b/c/d/e`
- 네트워크: `oob_ip`, `oob_netmask`, `oob_router` (Out-of-Band 관리)

**인벤토리 풍부도**: ★★★★★

**OpenManager AI 시사점**: 물리 서버 관리가 필요한 기업 환경에서 Zabbix 수준의 인벤토리를 모방하면 차별점이 될 수 있으나, 시뮬레이션 플랫폼에서는 과도함.

### 4.2 Datadog — 자동 감지 생태계

Datadog의 강점은 **gohai** (Go Hardware Inventory) 에이전트가 호스트 설치 시 자동으로 수집하는 하드웨어/소프트웨어 정보와 **클라우드 인테그레이션**의 조합이다.

**gohai 수집 카테고리 (5개 + processes)**:
- **cpu**: vendor_id, model_name, model, family, stepping, mhz, cache_size_bytes, cpu_cores, cpu_logical_processors, cpu_pkgs, cpu_numa_nodes (Windows: L1/L2/L3 cache 별도)
- **memory**: total, swap_total
- **filesystem**: name, kb_size, mounted_on (장치별 배열)
- **network**: ipaddress, ipaddressv6, macaddress, interfaces[]
- **platform**: hostname, FQDN, os, family, kernel_name, kernel_release, kernel_version, machine, processor, hardware_platform, go_version, go_os, go_arch, python_version
- **processes**: 실행 프로세스 정보

**클라우드 자동 감지**: AWS/GCP/Azure IMDS에서 자동으로 instance-type, region, AZ, VPC, security-groups 수집

**태그 시스템**: 무제한 key:value 태그 → 조직, 비용 센터, 서비스, 팀 등 임의의 메타데이터 부여 가능

**인벤토리 풍부도**: ★★★★☆

**OpenManager AI 시사점**: gohai 스타일의 정적 하드웨어 정보(CPU model, filesystem 장치별)를 ServerConfig에 추가하면 리얼리즘이 크게 향상됨.

### 4.3 New Relic — 이벤트 기반 분리

New Relic Infrastructure Agent는 데이터를 **5개 이벤트 타입**으로 분리하여 수집한다:

| Event Type | 주요 필드 | 수집 주기 |
|-----------|----------|----------|
| **SystemSample** | hostname, cpuPercent, cpuUserPercent, cpuSystemPercent, cpuStealPercent, memoryTotalBytes, memoryUsedBytes, memoryFreeBytes, memoryUsedPercent, swapTotalBytes, swapUsedBytes, diskUsedPercent, operatingSystem, kernelVersion, agentVersion, processorCount, coreCount, fullHostname, linuxDistribution, uptime | 5초 |
| **StorageSample** | device, mountPoint, filesystemType, totalBytes, usedBytes, freeBytes, usedPercent, inodesTotal, inodesUsed, inodesFree, isReadOnly | 20초 |
| **NetworkSample** | interfaceName, hardwareAddress, ipV4Address, ipV6Address, state, transmitBytesPerSecond, receiveBytesPerSecond, transmitPacketsPerSecond, receivePacketsPerSecond, transmitErrorsPerSecond, receiveErrorsPerSecond, transmitDroppedPerSecond, receiveDroppedPerSecond | 10초 |
| **ProcessSample** | processDisplayName, commandName, commandLine, pid, parentProcessId, userName, cpuPercent, memoryResidentSizeBytes, threadCount, ioReadBytesPerSecond, ioWriteBytesPerSecond | 20초 |
| **ContainerSample** | containerId, containerName, containerImage, containerImageId, cpuPercent, memoryUsageBytes, memoryLimitBytes, networkRxBytes, networkTxBytes, restartCount, state | 15초 |

**인벤토리 풍부도**: ★★★★☆

**OpenManager AI 시사점**: StorageSample/NetworkSample 패턴이 가장 참고할 만함. 현재 단일 %값을 장치별 분리 데이터로 확장하면 AI 분석 깊이가 향상됨.

### 4.4 Prometheus (node_exporter) — 메트릭 수집기의 표준

Prometheus 자체는 인벤토리 도구가 아니지만, **node_exporter**가 60개 이상의 collector를 통해 호스트 정보를 메트릭으로 노출한다.

**정적 메타데이터 (info metrics)**:

| Collector | Metric | Label 필드 |
|-----------|--------|-----------|
| uname | `node_uname_info` | sysname, release, version, machine, nodename, domainname |
| cpu | `node_cpu_info` | cpu, vendor_id, model_name, model, family, stepping, core_id, physical_id, microcode, cache_size, bugs |
| os_release | `node_os_info` | id, id_like, name, pretty_name, version, version_id, version_codename, build_id, variant, variant_id |
| dmi | `node_dmi_info` | bios_date, bios_vendor, bios_version, bios_release, board_name, board_serial, board_vendor, board_version, board_asset_tag, chassis_vendor, chassis_serial, chassis_asset_tag, product_family, product_name, product_serial, product_sku, product_uuid, product_version, system_vendor |
| netclass | `node_network_info` | address (MAC), broadcast, duplex, operstate, ifalias |
| nvme | `node_nvme_info` | NVMe device 정보 |
| diskstats | `node_disk_info` | Disk device 정보 |

> 특히 `node_dmi_info`는 SMBIOS/DMI에서 **20개 label**을 노출하여 BIOS, 메인보드, 섀시, 제품 정보(시리얼, UUID, 벤더)까지 제공. 이는 Zabbix 수준의 하드웨어 인벤토리에 근접.

**Service Discovery**: file_sd, dns_sd, consul_sd, ec2_sd, gce_sd, kubernetes_sd 등 20+ 메커니즘

**인벤토리 풍부도**: ★★★☆☆ (info metrics + DMI 고려 시 예상보다 풍부)

**OpenManager AI 시사점**: 이미 node_exporter 네이밍을 채택하고 있으므로, `node_uname_info`, `node_cpu_info`, `node_dmi_info` 패턴을 ServerConfig에 반영하면 자연스러운 확장.

### 4.5 AWS CloudWatch — 클라우드 네이티브 깊이

CloudWatch Agent + EC2 IMDS v2가 제공하는 메타데이터는 AWS 인프라에 특화되어 매우 깊다.

**IMDS v2 필드 (주요, `169.254.169.254/latest/meta-data/`)**:
- Instance: ami-id, instance-id, instance-type, instance-life-cycle, reservation-id, ami-launch-index, profile
- Network: hostname, local-hostname, local-ipv4, public-hostname, public-ipv4, mac, security-groups
- Network/interfaces: macs/{mac}/device-number, subnet-id, vpc-id, security-groups, security-group-ids, ipv6s, local-ipv4s, interface-id, owner-id
- Placement: availability-zone, region, group-name, host-id, partition-number
- Storage: block-device-mapping/ami, block-device-mapping/ebs{N}, block-device-mapping/root
- IAM: iam/info, iam/security-credentials/{role-name}
- Services: services/domain, services/partition
- Tags: tags/instance (opt-in)

**인벤토리 풍부도**: ★★★☆☆ (AWS 한정이지만 깊음)

### 4.6 Elastic (ECS) — 스키마 표준화

Elastic Common Schema는 **필드 네임스페이스**를 체계적으로 정의한다:

- `host.*`: hostname, id, ip[], mac[], architecture, type, uptime, domain, boot.id, pid_ns_ino
- `host.os.*`: name, version, kernel, family, platform, full, type
- `host.geo.*`: location (lat/lon), city_name, country_name, continent_name, region_name, timezone, postal_code, continent_code
- `host.risk.*`: calculated_level, calculated_score, calculated_score_norm, static_level, static_score, static_score_norm
- `cloud.*`: provider, region, availability_zone, account.id/name, instance.id/name, machine.type, project.id/name, service.name, origin.*, target.*
- `agent.*`: id, name, type, version, ephemeral_id, build.original
- `container.*`: id, name, image.name/tag/hash, runtime, labels, cpu.usage, memory.usage, disk.*, network.*
- `host.cpu.usage`, `host.disk.read.bytes`, `host.network.ingress.bytes` 등 (런타임)

**인벤토리 풍부도**: ★★★★☆

**OpenManager AI 시사점**: 이미 OTel 시맨틱 컨벤션(ECS와 유사)을 resource-catalog.json에서 사용 중. `host.os.kernel`, `host.architecture`, `host.geo.*` 확장이 자연스러움.

### 4.7 Nagios/Icinga — 수동 구성의 레거시

호스트 오브젝트 정의에 기본 필드가 매우 제한적:
- `host_name`, `alias`, `address`, `parents`, `hostgroups`, `check_command`
- 확장은 `_CUSTOM_VAR`에 의존 (표준 없음)

**인벤토리 풍부도**: ★☆☆☆☆

---

## 5. Prometheus 수집 경계 분석: 자동수집 vs 사람 입력

OpenManager AI가 Prometheus/node_exporter 스타일을 채택했으므로, **Prometheus 생태계 기준**으로 "무엇이 자동이고 무엇이 사람 입력인지"를 명확히 구분한다.

### 5.1 실제 Prometheus 환경에서의 데이터 출처

```
┌─────────────────────────────────────────────────────────────────┐
│                  Prometheus 서버 등록 데이터 흐름                  │
├──────────────────────┬──────────────────────────────────────────┤
│  사람 입력 (config)    │  node_exporter 자동수집 (/proc, /sys)    │
│  ─────────────────── │  ──────────────────────────────────────  │
│                      │                                          │
│  prometheus.yml:     │  ■ CPU                                   │
│  ┌────────────────┐  │    node_cpu_info{model_name, vendor_id,  │
│  │ target IP:port │  │      family, stepping, microcode, bugs}  │
│  │ job name       │  │    node_cpu_seconds_total (per core)     │
│  │ labels:        │  │    node_cpu_frequency_*_hertz            │
│  │   env          │  │                                          │
│  │   team         │  │  ■ Memory                                │
│  │   datacenter   │  │    node_memory_MemTotal/Free/Available   │
│  │   server_type  │  │    node_memory_Buffers/Cached/SwapTotal  │
│  │   (비즈니스 맥락) │  │    node_memory_Swap*/Dirty/Writeback    │
│  └────────────────┘  │                                          │
│                      │  ■ Disk (장치별)                           │
│  service discovery:  │    node_filesystem_size/free/avail_bytes  │
│  ┌────────────────┐  │    {device, mountpoint, fstype} 라벨      │
│  │ ec2_sd_config  │  │    node_disk_read/written_bytes_total    │
│  │ → region, AZ,  │  │    node_disk_io_time_seconds_total      │
│  │   instance_type│  │                                          │
│  │   vpc_id 등    │  │  ■ Network (인터페이스별)                   │
│  │ (클라우드 자동)  │  │    node_network_receive/transmit_bytes   │
│  └────────────────┘  │    node_network_info{address, duplex,    │
│                      │      operstate, speed}                   │
│  relabel_config:     │                                          │
│  ┌────────────────┐  │  ■ OS / System                           │
│  │ 라벨 변환/추가  │  │    node_uname_info{sysname, release,    │
│  │ 필터링         │  │      machine, nodename}                  │
│  └────────────────┘  │    node_os_info{name, version_id, ...}   │
│                      │    node_boot_time_seconds                │
│                      │    node_load1, node_load5, node_load15   │
│                      │                                          │
│                      │  ■ Hardware (DMI/SMBIOS)                 │
│                      │    node_dmi_info{system_vendor,          │
│                      │      product_name, bios_vendor, ...}     │
│                      │    (20개 라벨 — 물리 서버만 해당)           │
│                      │                                          │
│                      │  ■ Processes                             │
│                      │    node_procs_running/blocked             │
│                      │    node_forks_total                      │
└──────────────────────┴──────────────────────────────────────────┘
```

### 5.2 3-Zone 분류: 자동 / 사람 필수 / 사람 선택

| Zone | 출처 | 성격 | 필드 예시 |
|:----:|------|------|----------|
| **A** | node_exporter 자동 | 머신에서 읽어옴 (`/proc`, `/sys`, `/etc`) | CPU model, cores, memory total/free, disk 장치별, NIC별, OS, kernel, boot_time, load, DMI |
| **B** | 사람 필수 입력 | Prometheus가 알 수 없는 것 | target IP:port, job name |
| **C** | 사람 선택 입력 | 비즈니스/조직 맥락 | environment, team, datacenter, server_type, service_name, SLA tier |

#### Zone A: 자동수집 (node_exporter, ~200+ 메트릭)

사람이 **전혀 손대지 않아도** 수집되는 정보:

| 카테고리 | 자동수집 필드 | 수집 방식 |
|---------|-------------|----------|
| CPU 상세 | model_name, vendor_id, family, stepping, microcode, cache_size, frequency, bugs | `/proc/cpuinfo` |
| 메모리 상세 | MemTotal, MemFree, MemAvailable, Buffers, Cached, SwapTotal, SwapFree, Dirty, Writeback + 30개 | `/proc/meminfo` |
| 디스크 장치별 | device, mountpoint, fstype, size, free, avail (장치당) + IOPS, io_time | `/proc/diskstats`, `/proc/mounts` |
| 네트워크 NIC별 | interface, MAC(address), duplex, speed, operstate, rx/tx bytes/packets/errors | `/sys/class/net/` |
| OS/커널 | sysname, release, version, machine, nodename, domainname | `uname()` 시스콜 |
| OS 릴리스 | id, name, pretty_name, version, version_id, version_codename | `/etc/os-release` |
| DMI 하드웨어 | system_vendor, product_name, product_serial, product_uuid, bios_vendor, board_name (20개) | `/sys/class/dmi/` |
| 프로세스 | procs_running, procs_blocked, forks_total | `/proc/stat` |
| 시스템 | boot_time, load1/5/15, time, entropy, context_switches | `/proc/` |

#### Zone B: 사람 필수 입력 (최소 2개)

Prometheus 서버가 **반드시 알려줘야** 스크래핑이 시작되는 정보:

| 필드 | 설명 | 비고 |
|------|------|------|
| `target` (IP:port) | 어디를 스크래핑할지 | Service Discovery로 자동화 가능 (ec2_sd, k8s_sd) |
| `job` | 스크래핑 그룹명 | `prometheus.yml`에 정의 |

> **Service Discovery 사용 시**: 사람 입력이 **0개**까지 줄어들 수 있음. ec2_sd_config에 region만 지정하면 해당 리전의 모든 EC2 인스턴스를 자동 발견.

#### Zone C: 사람 선택 입력 (비즈니스 맥락)

node_exporter가 **절대 알 수 없는** 정보 — 조직/운영 관점의 라벨:

| 필드 | 목적 | 입력 빈도 |
|------|------|:--------:|
| `environment` | prod/staging/dev 구분 | 거의 항상 |
| `team` / `owner` | 담당팀 | 자주 |
| `datacenter` / `site` | 논리적 위치명 | 자주 |
| `server_type` / `role` | 비즈니스 역할 (web, db, cache) | 자주 |
| `service_name` | 서비스 소속 | 가끔 |
| `sla_tier` | SLA 등급 (gold, silver) | 드물게 |
| `cost_center` | 비용 부서 | 드물게 |
| `contact` | 장애 연락처 | 드물게 |

> 실무에서 Zone C 라벨은 보통 **3~5개** 정도 붙입니다. `env`, `team`, `datacenter`, `role` 정도가 가장 보편적.

### 5.3 OpenManager AI 현재 필드의 Zone 매핑

```
현재 ServerConfig           →  Prometheus Zone  →  현재 hourly-data JSON 위치
────────────────────────────────────────────────────────────────────────────
id                          →  B (target 파생)   →  instance 키 + nodeInfo 없음
name                        →  C (display name)  →  ❌ JSON에 미포함
type                        →  C (비즈니스 역할)   →  labels.server_type
location                    →  C (논리적 위치)    →  labels.datacenter
hostname                    →  A (자동수집 가능)   →  labels.hostname
ip                          →  B (target)        →  instance에 포함 안 됨 ★
os                          →  A (자동수집)       →  labels.os
osVersion                   →  A (자동수집)       →  labels.os_version
specs.cpu_cores             →  A (자동수집)       →  nodeInfo.cpu_cores
specs.memory_gb             →  A (자동수집)       →  nodeInfo.memory_total_bytes
specs.disk_gb               →  A (자동수집)       →  nodeInfo.disk_total_bytes
baseline.*                  →  ❌ (시뮬레이션 전용) →  JSON에 미포함 (생성 로직용)
```

**핵심 발견**:
- 현재 ServerConfig의 13개 필드 중 **Zone A(자동) 5개 + Zone B(필수) 1개 + Zone C(선택) 3개 + 시뮬레이션 전용 4개**
- Zone C 라벨은 `environment`(하드코딩 'production'), `server_type`, `datacenter` 3개 → 실무와 거의 동일한 수준
- **빠진 것**: Zone A 자동수집 영역 (CPU model, 메모리 상세, 디스크 장치별, NIC별, 커널)

### 5.4 확장 시 "사람 입력 허용 범위" 가이드라인

OpenManager AI가 시뮬레이션 플랫폼이라는 특성상, Zone A 자동수집 데이터도 `ServerConfig`에 **하드코딩**해야 한다. 그러나 어디까지 사람이 작성할지의 기준이 필요하다:

#### 원칙: "서버 프로비저닝 시 알 수 있는 것"만 ServerConfig에

```
ServerConfig에 넣을 것 (프로비저닝 시점에 알 수 있음)
─────────────────────────────────────────────────
✅ hostname, ip, type, location           — 인프라 설계서에 있음
✅ os, osVersion, kernel                  — OS 이미지 선택 시 결정됨
✅ cpu_cores, cpu_model, memory_gb        — 머신 스펙 주문 시 결정됨
✅ disk: [{device, mount, total, fstype}] — 파티션 설계 시 결정됨
✅ NIC: [{name, ip, speed}]              — 네트워크 설계 시 결정됨
✅ environment, team, datacenter          — 조직 정책으로 결정됨

ServerConfig에 넣지 않을 것 (런타임에만 알 수 있음)
─────────────────────────────────────────────────
❌ CPU usage, memory free, disk used      — 런타임 메트릭 (이미 metrics에)
❌ 프로세스 목록, PID                      — 실시간 변동
❌ network rx/tx bytes                    — 실시간 변동
❌ load average                           — 실시간 변동
❌ boot_time                              — 재부팅마다 변경 (이미 metrics에)
```

#### 실용적 확장 제안: ServerConfig + nodeInfo 분리

```typescript
// ServerConfig: 사람이 작성 (프로비저닝 시점 정보)
interface ServerConfig {
  // Zone B: 필수
  id: string;
  hostname: string;
  ip: string;

  // Zone C: 비즈니스 맥락
  name: string;
  type: ServerType;
  location: string;
  environment: 'production' | 'staging' | 'development';

  // Zone A 중 "프로비저닝 시 아는 것"
  os: string;
  osVersion: string;
  kernel: string;                    // NEW: OS 이미지에서 결정
  specs: {
    cpu_cores: number;
    cpu_model: string;               // NEW: 머신 스펙
    cpu_arch: 'x86_64' | 'aarch64'; // NEW: 아키텍처
    memory_gb: number;
    disks: DiskSpec[];               // NEW: 파티션 설계
    nics: NicSpec[];                 // NEW: 네트워크 설계
  };

  // 시뮬레이션 전용 (Prometheus에 없는 것)
  baseline: { cpu: number; memory: number; disk: number; network: number; };
}

type DiskSpec = {
  device: string;    // '/dev/sda1'
  mount: string;     // '/'
  fstype: string;    // 'ext4'
  total_gb: number;  // 80
};

type NicSpec = {
  name: string;      // 'eth0'
  ip: string;        // '10.10.1.11'
  speed_mbps: number; // 1000
};
```

이렇게 하면 hourly-data JSON의 `nodeInfo`가 자연스럽게 확장된다:

```json
{
  "nodeInfo": {
    "cpu_cores": 4,
    "cpu_model": "Intel Xeon E5-2686 v4",
    "cpu_arch": "x86_64",
    "memory_total_bytes": 8589934592,
    "kernel": "5.15.0-91-generic",
    "disks": [
      { "device": "/dev/sda1", "mount": "/", "fstype": "ext4",
        "total_bytes": 85899345920 },
      { "device": "/dev/sdb1", "mount": "/data", "fstype": "xfs",
        "total_bytes": 21474836480 }
    ],
    "interfaces": [
      { "name": "eth0", "ip": "10.10.1.11", "speed_mbps": 1000 }
    ]
  }
}
```

> 이 구조는 실제 Prometheus node_exporter의 `node_filesystem_size_bytes{device, mountpoint, fstype}` + `node_network_info{device, address, speed}` 와 1:1 대응된다.

---

## 6. 종합 평가 & 권장 확장

### 6.1 포지셔닝 매트릭스

```
인벤토리 풍부도
     ★★★★★ ┤ Zabbix
             │
     ★★★★☆ ┤ Datadog    New Relic    Elastic
             │
     ★★★☆☆ ┤ ┌──────────────────┐    CloudWatch    Prometheus
             │ │ OpenManager AI   │
     ★★☆☆☆ ┤ └──────────────────┘
             │
     ★☆☆☆☆ ┤ Nagios/Icinga
             │
             └───┬───────┬───────┬───────┬───
               자동    반자동   수동    정적
                          수집 방식
```

**현재 위치**: ★★★☆☆ — Prometheus와 CloudWatch 사이
- **강점**: OTel 시맨틱 컨벤션 채택, Prometheus 라벨 구조, 3-layer 데이터 모델, PRNG 재현성
- **약점**: 정적 JSON 기반 (자동 발견 없음), 하드웨어 상세 부족, 장치별 분리 없음

### 6.2 시뮬레이션 플랫폼 특성 고려

OpenManager AI는 실제 에이전트가 아닌 **시뮬레이션 데이터 생성기**이므로, 모든 상용 도구의 필드를 그대로 추가하는 것은 비효율적이다. 대신 **AI 분석 품질 향상**과 **대시보드 리얼리즘**에 직접 기여하는 필드를 우선해야 한다.

### 6.3 권장 확장 로드맵

#### Phase 1: 즉시 추가 가능 (sync-hourly-data.ts 수정만)

> 난이도: 낮음 | 영향: 중 | 예상 작업량: ServerConfig 확장 + 생성 로직 추가

| 추가 필드 | ServerConfig 키 | 예시 값 | 참고 모델 |
|----------|----------------|--------|----------|
| CPU model | `specs.cpu_model` | `"Intel Xeon E5-2686 v4"` | Datadog gohai |
| CPU architecture | `specs.cpu_arch` | `"x86_64"` | Prometheus node_uname_info |
| Kernel version | `kernel` | `"5.15.0-91-generic"` | New Relic kernelVersion |
| Memory free/swap | (런타임 메트릭 확장) | — | Prometheus node_memory_* |
| Uptime (boot time) | (이미 존재: `node_boot_time_seconds`) | — | 확인만 필요 |

**구현 예시**:
```typescript
interface ServerConfig {
  // 기존 필드...
  specs: {
    cpu_cores: number;
    cpu_model: string;      // NEW
    cpu_arch: string;        // NEW
    memory_gb: number;
    disk_gb: number;
  };
  kernel: string;            // NEW
}
```

#### Phase 2: 중기 확장 (데이터 모델 변경)

> 난이도: 중 | 영향: 높 | 예상 작업량: sync-hourly-data.ts + OTel pipeline + 대시보드 연동

| 추가 영역 | 변경 사항 | AI 분석 가치 |
|----------|----------|:----------:|
| **디스크 장치별 분리** | `nodeInfo.disks: [{device, mount, fstype, total, used}]` | ★★★★★ |
| **NIC별 stats** | `nodeInfo.interfaces: [{name, ip, mac, rx, tx, errors}]` | ★★★★☆ |
| **프로세스 Top-5** | `metrics.top_processes: [{name, pid, cpu, mem}]` | ★★★★☆ |
| **메모리 상세** | `metrics.memory_free_bytes, memory_cached_bytes, swap_*` | ★★★☆☆ |

**데이터 모델 예시 (Phase 2 적용 후)**:
```json
{
  "nodeInfo": {
    "cpu_cores": 4,
    "cpu_model": "Intel Xeon E5-2686 v4",
    "memory_total_bytes": 8589934592,
    "disks": [
      { "device": "/dev/sda1", "mount": "/", "fstype": "ext4", "total_bytes": 85899345920, "used_bytes": 24159191040 },
      { "device": "/dev/sdb1", "mount": "/data", "fstype": "xfs", "total_bytes": 21474836480, "used_bytes": 5368709120 }
    ],
    "interfaces": [
      { "name": "eth0", "ip": "10.10.1.11", "mac": "02:42:ac:11:00:02", "speed_mbps": 1000 }
    ]
  }
}
```

#### Phase 3: 장기 비전 (아키텍처 확장)

> 난이도: 높 | 시뮬레이션 플랫폼의 범위를 넘어서는 확장

| 영역 | 설명 | 필요 조건 |
|------|------|----------|
| **Service Discovery** | 동적 서버 등록/해제 메커니즘 | API + DB (Supabase) |
| **컨테이너 메타데이터** | Docker/K8s 시뮬레이션 | 새로운 서버 타입 추가 |
| **조직 태그** | team, owner, cost-center | 사용자 입력 UI 필요 |
| **Geo 위치** | 위도/경도 → 지도 시각화 | 대시보드 지도 컴포넌트 |

---

## 7. 부록: 도구별 공식 문서 참조

| 도구 | 인벤토리/메타데이터 공식 문서 |
|------|--------------------------|
| **Zabbix** | [Host inventory](https://www.zabbix.com/documentation/current/en/manual/config/hosts/inventory) — 71 정적 필드 |
| **Datadog** | [gohai (archived)](https://github.com/DataDog/gohai) — CPU/Memory/FS/Network/Platform |
| **New Relic** | [Default infrastructure data](https://docs.newrelic.com/docs/infrastructure/infrastructure-data/default-infra-data/) — 5 event types |
| **Prometheus** | [node_exporter](https://github.com/prometheus/node_exporter) — 60+ collectors |
| **CloudWatch** | [EC2 IMDS v2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-metadata.html) — 50+ 필드 |
| **Elastic** | [ECS Field Reference](https://www.elastic.co/guide/en/ecs/current/ecs-field-reference.html) — host/os/cloud/geo |
| **Nagios** | [Object Definitions](https://assets.nagios.com/downloads/nagioscore/docs/nagioscore/3/en/objectdefinitions.html) — host object |

---

*Last Updated: 2026-02-12*
*코드베이스 기준: v8.0.0, sync-hourly-data.ts (15 servers, PRNG-based)*
