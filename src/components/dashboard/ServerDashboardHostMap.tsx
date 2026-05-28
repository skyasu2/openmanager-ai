import type { Server } from '@/types/server';

const HOST_MAP_STATUS_CLASSES: Record<string, string> = {
  critical:
    'bg-rose-50 text-rose-900 ring-rose-300 shadow-rose-100 hover:bg-rose-100',
  warning:
    'bg-amber-50 text-amber-900 ring-amber-300 shadow-amber-100 hover:bg-amber-100',
  online:
    'bg-emerald-50 text-emerald-900 ring-emerald-300 shadow-emerald-100 hover:bg-emerald-100',
  offline:
    'bg-slate-100 text-slate-700 ring-slate-300 shadow-slate-100 hover:bg-slate-200',
  unknown:
    'bg-violet-50 text-violet-900 ring-violet-300 shadow-violet-100 hover:bg-violet-100',
};

function getHostMapNodeLabel(server: Server): string {
  const rawName = server.name || server.id || 'host';
  const initials = rawName
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || rawName.slice(0, 3).toUpperCase();
}

export function HexagonalHostMap({
  servers,
  onSelect,
}: {
  servers: Server[];
  onSelect: (server: Server) => void;
}) {
  return (
    <section
      data-testid="hexagonal-host-map"
      aria-label="Hexagonal host map"
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
      style={{ viewTransitionName: 'dashboard-hexagonal-host-map' }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">호스트 맵</h2>
          <p className="text-xs text-slate-500">
            상태와 부하를 한 화면에서 비교합니다.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {servers.length} nodes
        </span>
      </div>

      <div
        data-testid="hexagonal-host-map-grid"
        className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
      >
        {servers.map((server, index) => {
          const serverId = server.id || `server-${index}`;
          const statusClass =
            HOST_MAP_STATUS_CLASSES[server.status ?? 'unknown'] ??
            HOST_MAP_STATUS_CLASSES.unknown;

          return (
            <button
              key={serverId}
              type="button"
              data-testid={`hex-host-node-${serverId}`}
              aria-label={`${server.name} 호스트 맵 상세 보기`}
              onClick={() => onSelect(server)}
              className={`group relative flex aspect-[1.15/1] min-h-20 flex-col items-center justify-center overflow-hidden px-3 py-2 text-center shadow-sm ring-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${statusClass}`}
              style={{
                clipPath:
                  'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
              }}
            >
              <span className="text-sm font-bold tracking-wide">
                {getHostMapNodeLabel(server)}
              </span>
              <span className="mt-1 max-w-full truncate text-[11px] font-medium">
                {server.name}
              </span>
              <span className="mt-1 text-[10px] tabular-nums opacity-75">
                CPU {Math.round(server.cpu ?? 0)} · MEM{' '}
                {Math.round(server.memory ?? 0)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
