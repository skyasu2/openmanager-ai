import { forwardRef, type ImgHTMLAttributes } from 'react';

type StaticImageData = {
  src: string;
};

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | StaticImageData;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
};

const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    src,
    alt,
    fill: _fill,
    priority: _priority,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    ...props
  },
  ref
) {
  const resolvedSrc = typeof src === 'string' ? src : (src?.src ?? '');
  // biome-ignore lint/performance/noImgElement: Storybook mock intentionally renders native img.
  return <img ref={ref} src={resolvedSrc} alt={alt} {...props} />;
});

export default Image;
