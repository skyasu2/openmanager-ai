export class NextRequest extends Request {}

export class NextResponse extends Response {
  static json(data: unknown, init: ResponseInit = {}): NextResponse {
    return new NextResponse(JSON.stringify(data), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  static redirect(url: string | URL, init: number | ResponseInit = 307) {
    const status = typeof init === 'number' ? init : (init.status ?? 307);
    const headers = typeof init === 'number' ? undefined : init.headers;
    return new NextResponse(null, {
      status,
      headers: {
        location: String(url),
        ...(headers ?? {}),
      },
    });
  }

  static next(init?: ResponseInit): NextResponse {
    return new NextResponse(null, init);
  }
}

export function after(callback: () => void | Promise<void>): void {
  void callback();
}

export async function connection() {
  return {};
}
