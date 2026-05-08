import { describe, expect, it } from 'vitest';
import { recommendCommands } from './knowledge-command-tool';

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
});
