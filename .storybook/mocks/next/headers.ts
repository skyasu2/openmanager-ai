type Cookie = { name: string; value: string };

function createCookieStore() {
  const store = new Map<string, string>();

  return {
    get(name: string): Cookie | undefined {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll(): Cookie[] {
      return [...store.entries()].map(([name, value]) => ({ name, value }));
    },
    has(name: string): boolean {
      return store.has(name);
    },
    set(name: string, value: string): void {
      store.set(name, value);
    },
    delete(name: string): void {
      store.delete(name);
    },
  };
}

export function cookies() {
  return createCookieStore();
}

export function headers(): Headers {
  return new Headers();
}
