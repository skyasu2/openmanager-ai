/**
 * Agent Instructions Exports
 *
 * Central export point for all agent instructions.
 *
 * @version 1.2.0 - Vision Agent 추가
 */

// 공통 템플릿
export {
  BASE_AGENT_INSTRUCTIONS,
  IT_CONTEXT_INSTRUCTIONS,
  WEB_SEARCH_GUIDELINES,
} from './common-instructions';

// 에이전트별 인스트럭션
export { NLQ_INSTRUCTIONS } from './nlq';
export { ANALYST_INSTRUCTIONS } from './analyst';
export { REPORTER_INSTRUCTIONS } from './reporter';
export { ADVISOR_INSTRUCTIONS } from './advisor';
export { VISION_INSTRUCTIONS } from './vision';
