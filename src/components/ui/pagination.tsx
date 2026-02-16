import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { type ComponentProps, forwardRef } from 'react';
import type { ButtonProps } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Pagination = ({ className, ...props }: ComponentProps<'nav'>) => (
  <nav
    aria-label="pagination"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = forwardRef<HTMLUListElement, ComponentProps<'ul'>>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
);
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = forwardRef<HTMLLIElement, ComponentProps<'li'>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('', className)} {...props} />
  )
);
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, 'size'> &
  ComponentProps<'a'>;

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  children,
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'outline' : 'ghost',
        size,
      }),
      className
    )}
    {...props}
  >
    {children}
  </a>
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  ...props
}: ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="이전 페이지로 이동"
    size="default"
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <ChevronLeft className="h-4 w-4" />
    <span>이전</span>
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({
  className,
  ...props
}: ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label="다음 페이지로 이동"
    size="default"
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <span>다음</span>
    <ChevronRight className="h-4 w-4" />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  ...props
}: ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">더 많은 페이지</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
