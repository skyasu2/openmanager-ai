import domTestManifest from './dom-test-manifest.json';

// Tests that need a browser-like runtime or are intentionally grouped with
// the slower JSDOM suite for local developer ergonomics.
export const domTestPathPrefixes = [...domTestManifest.pathPrefixes];
export const domTestExactFiles = [...domTestManifest.exactFiles];
export const domTestGlobs = [
  ...domTestPathPrefixes.map(
    (prefix) => `${prefix}**/*.{test,spec}.{js,ts,tsx}`
  ),
  ...domTestExactFiles,
];
