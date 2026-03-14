import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react';

type UrlObject = {
  pathname?: string;
  query?: Record<string, string | number | boolean | undefined>;
};

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | UrlObject;
  children?: ReactNode;
  prefetch?: boolean;
};

function toHref(href: string | UrlObject): string {
  if (typeof href === 'string') return href;

  const pathname = href.pathname ?? '';
  const queryEntries = Object.entries(href.query ?? {}).filter(
    (_entry): _entry is [string, string | number | boolean] =>
      _entry[1] !== undefined
  );

  if (queryEntries.length === 0) return pathname;

  const query = new URLSearchParams();
  for (const [key, value] of queryEntries) {
    query.set(key, String(value));
  }

  return `${pathname}?${query.toString()}`;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch: _prefetch, ...props },
  ref
) {
  return (
    <a ref={ref} href={toHref(href)} {...props}>
      {children}
    </a>
  );
});

export default Link;
