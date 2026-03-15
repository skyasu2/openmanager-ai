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
  query: Record<string, string>;
  segments: Array<string | [string, string]>;
};

const DEFAULT_NAVIGATION_STATE: NavigationState = {
  pathname: '/',
  query: {},
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
  const [pathnameWithQuery, hashFragment] = href.split('#');
  const [pathname, queryString] = (pathnameWithQuery ?? '').split('?');
  const nextQuery = new URLSearchParams(queryString ?? '');
  if (hashFragment) {
    nextQuery.set('#', hashFragment);
  }

  globalThis.__STORYBOOK_NEXT_NAVIGATION__ = {
    ...getNavigationState(),
    pathname: pathname && pathname.length > 0 ? pathname : '/',
    query: Object.fromEntries(nextQuery.entries()),
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
  return new URLSearchParams(state.query);
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
