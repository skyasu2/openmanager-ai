type AppRouterInstance = {
  push: (href: string) => void;
  replace: (href: string) => void;
  prefetch: (href: string) => Promise<void>;
  back: () => void;
  forward: () => void;
  refresh: () => void;
};

type NavigationState = {
  pathname: string;
  queryEntries: Array<[string, string]>;
  segments: Array<string | [string, string]>;
};

const DEFAULT_NAVIGATION_STATE: NavigationState = {
  pathname: '/',
  queryEntries: [],
  segments: [],
};

declare global {
  // eslint-disable-next-line no-var
  var __STORYBOOK_NEXT_NAVIGATION__: NavigationState | undefined;
}

function getNavigationState(): NavigationState {
  const state = globalThis.__STORYBOOK_NEXT_NAVIGATION__;
  if (!state) return DEFAULT_NAVIGATION_STATE;
  return state;
}

function setPathnameFromHref(href: string): void {
  let pathname = '/';
  let queryEntries: Array<[string, string]> = [];

  try {
    const parsed = new URL(href, 'https://storybook.local');
    pathname = parsed.pathname || '/';
    queryEntries = Array.from(parsed.searchParams.entries());
  } catch {
    const [pathnameWithQuery] = href.split('#');
    const [fallbackPathname, queryString] = (pathnameWithQuery ?? '').split('?');
    pathname =
      fallbackPathname && fallbackPathname.length > 0 ? fallbackPathname : '/';
    queryEntries = Array.from(new URLSearchParams(queryString ?? '').entries());
  }

  globalThis.__STORYBOOK_NEXT_NAVIGATION__ = {
    ...getNavigationState(),
    pathname,
    queryEntries,
  };
}

export function useRouter(): AppRouterInstance {
  return {
    push: (href) => setPathnameFromHref(href),
    replace: (href) => setPathnameFromHref(href),
    prefetch: async () => undefined,
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
  };
}

export function usePathname(): string {
  return getNavigationState().pathname;
}

export function useSearchParams(): URLSearchParams {
  const state = getNavigationState();
  return new URLSearchParams(state.queryEntries);
}

export function useParams<T extends Record<string, string | string[]>>(): T {
  return {} as T;
}

export function useSelectedLayoutSegment(): string | null {
  const segments = useSelectedLayoutSegments();
  return segments.length > 0 ? (segments[0] ?? null) : null;
}

export function useSelectedLayoutSegments(): string[] {
  const state = getNavigationState();
  if (state.segments.length > 0) {
    return state.segments.map((segment) =>
      Array.isArray(segment) ? segment[1] : segment
    );
  }

  return state.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

export function redirect(url: string): never {
  throw new Error(
    `next/navigation redirect is not supported in Storybook: ${url}`
  );
}

export function permanentRedirect(url: string): never {
  throw new Error(
    `next/navigation permanentRedirect is not supported in Storybook: ${url}`
  );
}

export function notFound(): never {
  throw new Error('next/navigation notFound is not supported in Storybook');
}
