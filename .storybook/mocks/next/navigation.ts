type AppRouterInstance = {
  push: (href: string) => void;
  replace: (href: string) => void;
  prefetch: (href: string) => Promise<void>;
  back: () => void;
  forward: () => void;
  refresh: () => void;
};

export function useRouter(): AppRouterInstance {
  return {
    push: () => undefined,
    replace: () => undefined,
    prefetch: async () => undefined,
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
  };
}

export function usePathname(): string {
  return '/';
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams<T extends Record<string, string | string[]>>(): T {
  return {} as T;
}

export function useSelectedLayoutSegment(): string | null {
  return null;
}

export function useSelectedLayoutSegments(): string[] {
  return [];
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
