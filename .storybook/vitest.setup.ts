import { setProjectAnnotations } from '@storybook/nextjs-vite';

import * as projectAnnotations from './preview';

// Ensure Storybook preview-level annotations (decorators/parameters) apply in Vitest.
setProjectAnnotations([projectAnnotations]);
