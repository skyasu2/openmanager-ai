'use client';

/**
 * ClarificationDialog Component
 *
 * 모호한 쿼리에 대해 사용자에게 명확화 옵션을 제시하는 컴포넌트
 * Best Practice: 명확화 다이얼로그로 성공률 67% → 91% 향상
 */

import { HelpCircle, MessageSquare, X } from 'lucide-react';
import { type FC, memo, useState } from 'react';
import type {
  ClarificationOption,
  ClarificationRequest,
} from '@/hooks/ai/useHybridAIQuery';

interface ClarificationDialogProps {
  clarification: ClarificationRequest;
  onSelectOption: (option: ClarificationOption) => void;
  onSubmitCustom: (customInput: string) => void;
  /** 명확화 건너뛰기 (원본 쿼리 그대로 실행) */
  onSkip: () => void;
  /** 명확화 취소 (쿼리 미실행, 상태 정리만) */
  onDismiss?: () => void;
}

const categoryIcons: Record<ClarificationOption['category'], string> = {
  specificity: '🎯',
  timerange: '⏰',
  scope: '📊',
  custom: '✏️',
};

const categoryColors: Record<ClarificationOption['category'], string> = {
  specificity:
    'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300',
  timerange:
    'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300',
  scope:
    'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300',
  custom:
    'border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-300',
};

export const ClarificationDialog: FC<ClarificationDialogProps> = memo(
  ({ clarification, onSelectOption, onSubmitCustom, onSkip, onDismiss }) => {
    const [customInput, setCustomInput] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    const handleCustomSubmit = () => {
      if (customInput.trim()) {
        onSubmitCustom(customInput.trim());
        setCustomInput('');
      }
    };

    return (
      <div
        className="mx-4 my-3 rounded-xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 p-4 shadow-sm"
        data-testid="clarification-dialog"
      >
        {/* 헤더 */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
              <HelpCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                조금 더 구체적으로 알려주세요
              </h3>
              <p className="text-xs text-gray-500">{clarification.reason}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss ?? onSkip}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="명확화 취소"
            data-testid="clarification-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 원본 쿼리 표시 */}
        <div className="mb-3 rounded-lg bg-white/70 px-3 py-2 text-sm text-gray-600 border border-gray-100">
          <span className="text-gray-400">입력:</span>{' '}
          <span className="font-medium">"{clarification.originalQuery}"</span>
        </div>

        {/* 옵션 그리드 */}
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {clarification.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectOption(option)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all ${categoryColors[option.category]}`}
            >
              <span className="text-base">
                {categoryIcons[option.category]}
              </span>
              <span className="text-gray-700">{option.text}</span>
            </button>
          ))}
        </div>

        {/* 커스텀 입력 토글 */}
        {!showCustomInput ? (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white/50 py-2 text-sm text-gray-500 hover:border-gray-400 hover:bg-white/80 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>직접 입력하기</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customInput.trim()) {
                  handleCustomSubmit();
                }
              }}
              placeholder="추가 정보를 입력하세요..."
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={handleCustomSubmit}
              disabled={!customInput.trim()}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              확인
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onSkip}
          className="mt-2 flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
          data-testid="clarification-skip"
        >
          건너뛰고 바로 실행
        </button>

        {/* 취소 힌트 */}
        <p className="mt-2 text-center text-xs text-gray-400">
          X를 누르면 질문을 취소합니다
        </p>
      </div>
    );
  }
);

ClarificationDialog.displayName = 'ClarificationDialog';
