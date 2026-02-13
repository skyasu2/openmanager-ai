import type { Server } from '@/types/server';

export type LogExplorerFilterState = {
  level: 'info' | 'warn' | 'error' | 'all';
  source: string; // '' = all
  serverId: string; // '' = all
  keyword: string;
};

export type LogExplorerModalProps = {
  open: boolean;
  onClose: () => void;
  servers: Server[];
};
