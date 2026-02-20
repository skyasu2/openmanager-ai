/**
 * Lightweight stub for lucide-react
 * Prevents vitest from resolving 3800+ icon files in node_modules on WSL.
 * Loaded via resolve.alias in vitest.config.main.ts.
 *
 * Uses module.exports Proxy so that ANY named import (e.g. `import { ChevronDown }`)
 * resolves to a noop React component instead of undefined.
 */
const noop = () => null;

// Common icons used in codebase - explicit exports for ESM compatibility
export const Activity = noop;
export const AlertCircle = noop;
export const AlertTriangle = noop;
export const ArrowLeftFromLine = noop;
export const ArrowRight = noop;
export const BarChart3 = noop;
export const BookOpen = noop;
export const Bot = noop;
export const Brain = noop;
export const CheckCircle = noop;
export const CheckSquare = noop;
export const ChevronDown = noop;
export const ChevronUp = noop;
export const Clock = noop;
export const Cpu = noop;
export const Database = noop;
export const ExternalLink = noop;
export const FileText = noop;
export const Github = noop;
export const Globe = noop;
export const HelpCircle = noop;
export const LayoutGrid = noop;
export const List = noop;
export const Loader2 = noop;
export const LogOut = noop;
export const MapPin = noop;
export const Maximize2 = noop;
export const MessageSquare = noop;
export const Monitor = noop;
export const Network = noop;
export const PanelRightClose = noop;
export const PanelRightOpen = noop;
export const Pause = noop;
export const Play = noop;
export const Plus = noop;
export const RefreshCw = noop;
export const RotateCcw = noop;
export const Search = noop;
export const Server = noop;
export const Shield = noop;
export const Sparkles = noop;
export const Target = noop;
export const Timer = noop;
export const TrendingUp = noop;
export const User = noop;
export const X = noop;
export const Zap = noop;

// Type stub
export type LucideIcon = typeof noop;

// Catch-all: re-export Proxy as default for dynamic access patterns
const stub = new Proxy(noop, {
  get(_target, prop) {
    if (prop === '__esModule') return true;
    if (typeof prop === 'symbol') return undefined;
    return noop;
  },
});

export default stub;
export { noop as createLucideIcon };
