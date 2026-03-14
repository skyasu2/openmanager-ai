import {
  type ComponentType,
  lazy,
  type ReactElement,
  type ReactNode,
  Suspense,
} from 'react';

type DynamicImportResult<P> =
  | Promise<{ default: ComponentType<P> }>
  | Promise<ComponentType<P>>;

type DynamicOptions = {
  loading?: () => ReactNode;
  ssr?: boolean;
};

export default function dynamic<P extends object>(
  loader: () => DynamicImportResult<P>,
  options?: DynamicOptions
): ComponentType<P> {
  const LazyComponent = lazy(async () => {
    const imported = await loader();
    if (typeof imported === 'function') return { default: imported };
    return imported;
  });

  const Loading = options?.loading;

  return function DynamicComponent(props: P): ReactElement {
    return (
      <Suspense fallback={Loading ? Loading() : null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
