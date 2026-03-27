export { searchWithGrounding } from './vision-grounding-tool';
export { analyzeLargeLog } from './vision-log-tool';
export { analyzeScreenshot } from './vision-screenshot-tool';
export { analyzeUrlContent } from './vision-url-tool';
export type {
  LogAnalysisResult,
  ScreenshotAnalysisResult,
  SearchGroundingResult,
  UrlContentResult,
} from './vision-types';

import { searchWithGrounding } from './vision-grounding-tool';
import { analyzeLargeLog } from './vision-log-tool';
import { analyzeScreenshot } from './vision-screenshot-tool';
import { analyzeUrlContent } from './vision-url-tool';

export const visionTools = {
  analyzeScreenshot,
  analyzeLargeLog,
  searchWithGrounding,
  analyzeUrlContent,
};

export const visionToolDescriptions = {
  analyzeScreenshot: '스크린샷 분석 결과 구조화 (이미지는 message content로 전달)',
  analyzeLargeLog: '로그 분석 전처리 + 결과 구조화',
  searchWithGrounding: 'Google Search Grounding 실시간 검색',
  analyzeUrlContent: 'URL 콘텐츠 추출 및 분석',
};
