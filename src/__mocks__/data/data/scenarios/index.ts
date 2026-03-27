import type { ScenarioTimeline } from '../types';
import { scenario3 } from './cacheFailure';
import { scenario1 } from './dbOverload';
import { scenario4 } from './networkBottleneck';
import { scenario2 } from './storageFull';

export const SCENARIO_TIMELINES: ScenarioTimeline[] = [
  scenario1,
  scenario2,
  scenario3,
  scenario4,
];

export { scenario1, scenario2, scenario3, scenario4 };
