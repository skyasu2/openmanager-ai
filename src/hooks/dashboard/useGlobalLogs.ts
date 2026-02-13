'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateServerLogs } from '@/services/server-data/server-data-loader';
import type { ServerLogEntry } from '@/services/server-data/server-data-types';
import type { Server } from '@/types/server';
import { getErrorMessage } from '@/types/type-utils';

export type GlobalLogEntry = ServerLogEntry & {
  serverId: string;
};

export type GlobalLogFilter = {
  level?: 'info' | 'warn' | 'error';
  source?: string;
  keyword?: string;
  serverId?: string;
};

export type GlobalLogsResult = {
  logs: GlobalLogEntry[];
  stats: {
    total: number;
    info: number;
    warn: number;
    error: number;
  };
  sources: string[];
  serverIds: string[];
  isError: boolean;
  errorMessage: string | null;
  retry: () => void;
};

export function useGlobalLogs(
  servers: Server[],
  filter: GlobalLogFilter = {}
): GlobalLogsResult {
  const [rawLogs, setRawLogs] = useState<GlobalLogEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const serversRef = useRef(servers);
  const serversSignature = useMemo(
    () =>
      servers
        .map(
          (server) =>
            `${server.id}:${server.cpu ?? 0}:${server.memory ?? 0}:${server.disk ?? 0}:${server.network ?? 0}`
        )
        .join('|'),
    [servers]
  );
  const generate = useCallback((trigger?: string) => {
    void trigger;
    const allLogs: GlobalLogEntry[] = [];
    let firstError: string | null = null;
    for (const server of serversRef.current) {
      try {
        const metrics = {
          cpu: server.cpu ?? 0,
          memory: server.memory ?? 0,
          disk: server.disk ?? 0,
          network: server.network ?? 0,
        };
        const logs = generateServerLogs(metrics, server.id);
        for (const log of logs) {
          allLogs.push({ ...log, serverId: server.id });
        }
      } catch (error) {
        if (firstError === null) {
          firstError = getErrorMessage(error);
        }
      }
    }
    // Sort newest first
    allLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setRawLogs(allLogs);
    setErrorMessage(
      firstError === null
        ? null
        : `일부 서버 로그를 생성하지 못했습니다: ${firstError}`
    );
  }, []);
  const retry = useCallback(() => {
    generate();
  }, [generate]);

  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  useEffect(() => {
    generate(serversSignature);
  }, [serversSignature, generate]);

  // Regenerate every 60s
  useEffect(() => {
    const interval = setInterval(generate, 60_000);
    return () => clearInterval(interval);
  }, [generate]);

  // Available filter values
  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const log of rawLogs) {
      set.add(log.source);
    }
    return Array.from(set).sort();
  }, [rawLogs]);

  const serverIds = useMemo(() => {
    const set = new Set<string>();
    for (const log of rawLogs) {
      set.add(log.serverId);
    }
    return Array.from(set).sort();
  }, [rawLogs]);

  // Filtered logs
  const logs = useMemo(() => {
    let filtered = rawLogs;

    if (filter.level) {
      filtered = filtered.filter((l) => l.level === filter.level);
    }
    if (filter.source) {
      filtered = filtered.filter((l) => l.source === filter.source);
    }
    if (filter.serverId) {
      filtered = filtered.filter((l) => l.serverId === filter.serverId);
    }
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      filtered = filtered.filter((l) => l.message.toLowerCase().includes(kw));
    }

    return filtered;
  }, [rawLogs, filter.level, filter.source, filter.serverId, filter.keyword]);

  const stats = useMemo(
    () => ({
      total: logs.length,
      info: logs.filter((l) => l.level === 'info').length,
      warn: logs.filter((l) => l.level === 'warn').length,
      error: logs.filter((l) => l.level === 'error').length,
    }),
    [logs]
  );

  return {
    logs,
    stats,
    sources,
    serverIds,
    isError: errorMessage !== null,
    errorMessage,
    retry,
  };
}
