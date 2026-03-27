import { Bot } from 'lucide-react';
import { TECH_STACKS_DATA, type VibeCodeData } from '@/data/tech-stacks.data';
import type {
  FeatureCardModalProps,
  TechItem,
} from '@/types/feature-card.types';

type SelectedCard = NonNullable<FeatureCardModalProps['selectedCard']>;

type CategorizedTechData = {
  allCards: TechItem[];
  currentCards: TechItem[];
  hasData: boolean;
  isVibeCard: boolean;
  historyStages: VibeCodeData['history'] | null;
  categorized: {
    critical: TechItem[];
    high: TechItem[];
    medium: TechItem[];
    low: TechItem[];
  };
};

export const EMPTY_CATEGORIZED_TECH_DATA: CategorizedTechData = {
  allCards: [],
  currentCards: [],
  hasData: false,
  isVibeCard: false,
  historyStages: null,
  categorized: {
    critical: [],
    high: [],
    medium: [],
    low: [],
  },
};

export const isValidCard = (card: unknown): card is SelectedCard => {
  return (
    typeof card === 'object' &&
    card !== null &&
    'id' in card &&
    'title' in card &&
    'icon' in card &&
    'gradient' in card
  );
};

export const sanitizeModalText = (text: string): string => {
  if (typeof text !== 'string') return '';
  return text.replace(/<script[^>]*>.*?<\/script>/gi, '').substring(0, 1000);
};

export function getSafeCardData(selectedCard: unknown) {
  if (!isValidCard(selectedCard)) {
    return {
      title: '',
      icon: Bot,
      gradient: 'from-blue-500 to-purple-600',
      detailedContent: { overview: '', features: [], technologies: [] },
      id: null,
      requiresAI: false,
      subSections: undefined,
    };
  }

  return {
    title: sanitizeModalText(selectedCard.title),
    icon: selectedCard.icon || Bot,
    gradient: selectedCard.gradient || 'from-blue-500 to-purple-600',
    detailedContent: selectedCard.detailedContent || {
      overview: '',
      features: [],
      technologies: [],
    },
    id: selectedCard.id,
    requiresAI: selectedCard.requiresAI || false,
    subSections: selectedCard.subSections,
  };
}

export function buildCategorizedTechData(
  selectedCardId: string | null,
  isHistoryView: boolean
): CategorizedTechData {
  const result: CategorizedTechData = {
    ...EMPTY_CATEGORIZED_TECH_DATA,
    categorized: {
      critical: [],
      high: [],
      medium: [],
      low: [],
    },
  };

  if (!selectedCardId) {
    return result;
  }

  const data = TECH_STACKS_DATA[selectedCardId] || null;
  if (!data) {
    return result;
  }

  if (selectedCardId === 'vibe-coding' && 'current' in data) {
    const vibeData = data as VibeCodeData;
    result.isVibeCard = true;
    result.historyStages = vibeData.history || null;
    result.currentCards = vibeData.current || [];

    if (isHistoryView && vibeData.history) {
      result.allCards = ([] as TechItem[]).concat(
        vibeData.history.stage1 || [],
        vibeData.history.stage2 || [],
        vibeData.history.stage3 || []
      );
    } else {
      result.allCards = vibeData.current || [];
    }
  } else {
    result.allCards = Array.isArray(data) ? data : [];
  }

  result.allCards.forEach((tech) => {
    const importance = tech.importance;
    if (result.categorized[importance]) {
      result.categorized[importance].push(tech);
    }
  });

  result.hasData = result.allCards.length > 0;
  return result;
}
