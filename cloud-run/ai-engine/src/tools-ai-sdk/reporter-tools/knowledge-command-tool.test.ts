import { describe, expect, it } from 'vitest';
import { recommendCommands } from './knowledge-command-tool';
import {
  buildServiceCommandGuidanceAnswer,
  getCommandRecommendations,
} from './knowledge-command-catalog';

async function executeRecommendCommands(keywords: string[]) {
  return recommendCommands.execute({ keywords }, {} as never);
}

describe('recommendCommands', () => {
  it('recommends HAProxy runtime socket commands for backend status questions', async () => {
    const result = await executeRecommendCommands([
      'haproxy',
      'backend',
      '상태',
      '명령어',
    ]);
    const commands = result.recommendations.map((item) => item.command);

    expect(commands).toContain(
      'echo "show stat" | socat - /run/haproxy/admin.sock'
    );
    expect(commands).toContain('systemctl status haproxy --no-pager');
  });

  it('recommends Nginx access-log commands for 5xx path analysis', async () => {
    const result = await executeRecommendCommands([
      'nginx',
      'access',
      '5xx',
      '경로',
    ]);
    const commands = result.recommendations.map((item) => item.command);

    expect(commands).toContain(
      "awk '$9 ~ /^5/ {print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head"
    );
  });

  it('recommends NFS verification and remount commands', async () => {
    const result = await executeRecommendCommands([
      'nfs',
      'mount',
      '재마운트',
      '순서',
    ]);
    const commands = result.recommendations.map((item) => item.command);

    expect(commands).toContain('findmnt -t nfs');
    expect(commands).toContain('showmount -e <nfs-server>');
    expect(commands).toContain('mount -t nfs <nfs-server>:/export/path /mnt/path');
  });

  it('prioritizes disk capacity commands over MySQL service commands', async () => {
    const result = await executeRecommendCommands([
      'mysql',
      '디스크',
      '용량',
    ]);
    const commands = result.recommendations.map((item) => item.command);

    expect(commands[0]).toBe('df -h');
    expect(commands).toContain('du -xhd1 / 2>/dev/null | sort -hr | head -20');
    expect(commands).toContain('df -ih');
    expect(commands.slice(0, 3)).not.toContain('mysql -e "SHOW FULL PROCESSLIST"');
  });

  it('prioritizes filesystem capacity checks over NFS remounts for disk cleanup', async () => {
    const result = await executeRecommendCommands([
      'nfs',
      '디스크',
      '용량',
    ]);
    const commands = result.recommendations.map((item) => item.command);

    expect(commands[0]).toBe('df -h');
    expect(commands).toContain('du -xhd1 / 2>/dev/null | sort -hr | head -20');
    expect(commands).toContain('df -ih');
    expect(commands.slice(0, 3)).not.toContain('mount -t nfs <nfs-server>:/export/path /mnt/path');
  });

  it('keeps service-specific MySQL slow-query commands intact', async () => {
    const result = await executeRecommendCommands([
      'mysql',
      'slow',
      '확인',
    ]);
    const commands = result.recommendations.map((item) => item.command);

    expect(commands).toContain('mysql -e "SHOW FULL PROCESSLIST"');
    expect(commands).toContain("mysql -e \"SHOW VARIABLES LIKE 'slow_query_log%'\"");
  });

  it('does not let generic keywords pull in unrelated service commands', () => {
    const commands = getCommandRecommendations(['확인', 'cpu']).map(
      (item) => item.command
    );

    expect(commands[0]).toBe('top -o cpu');
    expect(commands).toContain('ps aux --sort=-%cpu | head -10');
    expect(commands).not.toContain('findmnt -t nfs');
  });

  it('uses host memory commands for generic memory pressure without Redis context', async () => {
    const result = await executeRecommendCommands(['메모리']);
    const commands = result.recommendations.map((item) => item.command);

    expect(commands[0]).toBe('free -h');
    expect(commands).toContain('ps aux --sort=-%mem | head -10');
    expect(commands).not.toContain('redis-cli --bigkeys');
  });

  it('builds deterministic disk cleanup guidance for server-specific capacity questions', () => {
    const answer = buildServiceCommandGuidanceAnswer(
      'db-mysql-dc1-primary 디스크 86%, 용량 확보 명령어는?'
    );

    expect(answer).toContain('df -h');
    expect(answer).toContain('du -xhd1 / 2>/dev/null | sort -hr | head -20');
    expect(answer).not.toContain('SHOW FULL PROCESSLIST');
  });
});
