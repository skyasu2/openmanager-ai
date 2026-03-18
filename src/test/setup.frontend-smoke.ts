import '@testing-library/jest-dom/vitest';
import React from 'react';

// Legacy JSX-based tests in the smoke suite still rely on global React.
globalThis.React = React;
