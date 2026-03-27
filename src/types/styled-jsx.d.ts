/**
 * styled-jsx TypeScript declarations
 * Adds 'jsx' and 'global' attributes to style elements
 */

import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
