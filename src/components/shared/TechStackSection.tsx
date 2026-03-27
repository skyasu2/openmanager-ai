import type { TechItem } from '@/types/feature-card.types';
import { TechCard } from './TechCard';

export type TechStackSectionProps = {
  criticalTech: TechItem[];
  highTech: TechItem[];
  mediumTech: TechItem[];
  lowTech: TechItem[];
};

/**
 * 중요도별 기술 스택 섹션
 * Critical → High → Medium → Low 순서로 기술 카드 표시
 */
export function TechStackSection({
  criticalTech,
  highTech,
  mediumTech,
  lowTech,
}: TechStackSectionProps) {
  return (
    <div className="space-y-8">
      {/* 필수 기술 (Critical) */}
      {criticalTech.length > 0 && (
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-red-300">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            필수 기술 (Critical)
            <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs text-red-300">
              {criticalTech.length}개
            </span>
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {criticalTech.map((tech) => (
              <TechCard key={tech.name} tech={tech} />
            ))}
          </div>
        </div>
      )}

      {/* 중요 기술 (High) */}
      {highTech.length > 0 && (
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-orange-300">
            <div className="h-3 w-3 rounded-full bg-orange-400" />
            중요 기술 (High)
            <span className="rounded-full bg-orange-500/20 px-2 py-1 text-xs text-orange-300">
              {highTech.length}개
            </span>
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {highTech.map((tech) => (
              <TechCard key={tech.name} tech={tech} />
            ))}
          </div>
        </div>
      )}

      {/* 보통 기술 (Medium) */}
      {mediumTech.length > 0 && (
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-blue-300">
            <div className="h-3 w-3 rounded-full bg-blue-400" />
            보통 기술 (Medium)
            <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-300">
              {mediumTech.length}개
            </span>
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mediumTech.map((tech) => (
              <TechCard key={tech.name} tech={tech} />
            ))}
          </div>
        </div>
      )}

      {/* 낮은 우선순위 기술 (Low) */}
      {lowTech.length > 0 && (
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-300">
            <div className="h-3 w-3 rounded-full bg-gray-400" />
            보조 기술 (Low)
            <span className="rounded-full bg-gray-500/20 px-2 py-1 text-xs text-gray-300">
              {lowTech.length}개
            </span>
          </h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {lowTech.map((tech) => (
              <TechCard key={tech.name} tech={tech} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
