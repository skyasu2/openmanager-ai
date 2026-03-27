import { logger } from './logger';
/**
 * Text Sanitizer for AI Responses
 *
 * Removes or replaces Chinese characters (Hanzi) from LLM outputs.
 * LLM models sometimes output Chinese characters even when instructed
 * to respond in Korean due to training data patterns.
 *
 * @version 1.0.0
 * @created 2025-01-05
 */

// ============================================================================
// Known Chinese-Korean Mappings
// ============================================================================

/**
 * Common Chinese phrases that appear in server monitoring context
 * with their Korean equivalents
 */
const CHINESE_TO_KOREAN_MAP: Record<string, string> = {
  // Status terms
  稳定: '안정적',
  正常: '정상',
  异常: '이상',
  警告: '경고',
  严重: '심각',
  危险: '위험',
  错误: '오류',
  失败: '실패',
  成功: '성공',

  // Server/System terms
  服务器: '서버',
  系统: '시스템',
  内存: '메모리',
  磁盘: '디스크',
  网络: '네트워크',
  数据库: '데이터베이스',

  // Analysis terms
  分析: '분석',
  报告: '보고서',
  建议: '권장',
  原因: '원인',
  解决: '해결',
  处理: '처리',
  监控: '모니터링',

  // Common phrases
  没有问题: '문제 없음',
  需要注意: '주의 필요',
  立即处理: '즉시 처리',
};

// ============================================================================
// Foreign Language Patterns (Non-Korean/English)
// ============================================================================

/**
 * Common foreign words/phrases that LLMs incorrectly output
 * with their Korean equivalents
 */
const FOREIGN_TO_KOREAN_MAP: Record<string, string> = {
  // Vietnamese (Latin with diacritics)
  'hiện': '현재',
  'và': '및',
  'xác định': '확인',
  'xác': '확',
  'định': '정',
  'người': '사람',
  'được': '되다',
  'không': '안',
  'trong': '안에',
  'có thể': '가능',
  // Russian (Cyrillic)
  'цик': '사이클',
  'циклон': '사이클론',
  // German
  'Menschen': '사람',
  'und': '및',
  'unterstüt': '지원',
  'unterstützen': '지원하다',
  'Lösung': '해결책',
  'lösung': '해결책',
  // Japanese Katakana/Hiragana (common mixed outputs)
  'セント': '세인트',
  'ヘレンス': '헬렌스',
  // Turkish (Latin with diacritics)
  'önemli': '중요한',
  'öğren': '배우다',
  'güzel': '아름다운',
  // Common artifacts
  '_UNUSED_': '',
};

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Check if text contains Chinese characters (CJK Unified Ideographs)
 * Range: U+4E00 to U+9FFF
 */
export function containsChineseCharacters(text: string): boolean {
  return /[\u4E00-\u9FFF]/.test(text);
}

/**
 * Check if text contains other foreign characters (Cyrillic, Japanese, Thai, Arabic, etc.)
 */
export function containsForeignCharacters(text: string): boolean {
  // Cyrillic: U+0400-U+04FF
  // Japanese Hiragana: U+3040-U+309F
  // Japanese Katakana: U+30A0-U+30FF
  // Thai: U+0E00-U+0E7F
  // Arabic: U+0600-U+06FF
  return /[\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u0E00-\u0E7F\u0600-\u06FF]/.test(text);
}

/**
 * Sanitize AI response by replacing foreign characters with Korean equivalents
 *
 * Strategy:
 * 1. Replace known foreign phrases (Chinese, Japanese, Russian, German, Vietnamese)
 * 2. Remove any remaining CJK/Cyrillic/Japanese characters
 * 3. Clean up artifacts like _UNUSED_
 *
 * @param text - Raw LLM response text
 * @returns Sanitized text with foreign characters replaced/removed
 */
export function sanitizeChineseCharacters(text: string): string {
  if (!text) {
    return text;
  }

  let result = text;
  let needsSanitization = containsChineseCharacters(text) || containsForeignCharacters(text);

  // Also check for known foreign words that might not trigger character detection
  for (const foreignWord of Object.keys(FOREIGN_TO_KOREAN_MAP)) {
    if (result.includes(foreignWord)) {
      needsSanitization = true;
      break;
    }
  }

  if (!needsSanitization) {
    return text;
  }

  // 1. Replace known Chinese phrases first (preserves meaning)
  for (const [chinese, korean] of Object.entries(CHINESE_TO_KOREAN_MAP)) {
    result = result.replace(new RegExp(chinese, 'g'), korean);
  }

  // 2. Replace known foreign phrases (Vietnamese, Russian, German, Japanese)
  for (const [foreign, korean] of Object.entries(FOREIGN_TO_KOREAN_MAP)) {
    result = result.replace(new RegExp(foreign, 'g'), korean);
  }

  // 3. If Chinese characters still remain, remove them
  if (containsChineseCharacters(result)) {
    const remaining = result.match(/[\u4E00-\u9FFF]+/g);
    if (remaining) {
      logger.warn(
        `⚠️ [TextSanitizer] Unknown Chinese phrases detected: ${remaining.join(', ')}. Consider adding to mapping.`
      );
    }
    result = result.replace(/[\u4E00-\u9FFF]+/g, '');
  }

  // 4. If other foreign characters remain (Cyrillic, Japanese, Thai, Arabic), remove them
  if (containsForeignCharacters(result)) {
    const remaining = result.match(/[\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u0E00-\u0E7F\u0600-\u06FF]+/g);
    if (remaining) {
      logger.warn(
        `⚠️ [TextSanitizer] Unknown foreign characters detected: ${remaining.join(', ')}. Consider adding to mapping.`
      );
    }
    result = result.replace(/[\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\u0E00-\u0E7F\u0600-\u06FF]+/g, '');
  }

  // 5. Clean up any double spaces or orphaned punctuation
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

/**
 * Sanitize a JSON object's string values recursively
 * Useful for API responses that have nested text fields
 */
export function sanitizeJsonStrings<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeChineseCharacters(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeJsonStrings(item)) as T;
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizeJsonStrings(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Create a sanitized wrapper for agent generate function
 * Can be used to wrap any agent's generate method
 */
export function createSanitizedAgent<T extends { generate: (opts: { prompt: string }) => Promise<{ text: string }> }>(
  agent: T
): T {
  const originalGenerate = agent.generate.bind(agent);

  const sanitizedGenerate = async (opts: { prompt: string }) => {
    const result = await originalGenerate(opts);
    return {
      ...result,
      text: sanitizeChineseCharacters(result.text),
    };
  };

  return {
    ...agent,
    generate: sanitizedGenerate,
  } as T;
}
