/**
 * Recharts 3.x 타입 정의 확장
 *
 * 1. PieProps children prop 지원:
 *    Recharts 3.x PieProps에 children prop이 명시적으로 정의되어 있지 않지만,
 *    Cell 패턴 (<Pie><Cell /></Pie>)은 공식적으로 지원되는 패턴입니다.
 *
 * 2. ChartDataInput 호환성:
 *    프로젝트의 ChartDataPoint 타입이 Recharts의 ChartDataInput과 호환되도록 보장합니다.
 *
 * 3. Legend formatter 타입 확장:
 *    LegendPayload의 color가 optional이므로 타입 확장으로 처리합니다.
 */

import { ReactNode } from 'react';

/** Chart data point with required properties for Recharts */
interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number | undefined;
}

/** Legend entry payload */
interface LegendEntry {
  value: string;
  color?: string;
  payload?: ChartDataPoint;
}

declare module 'recharts' {
  // Pie 컴포넌트 타입 확장
  interface PieProps {
    children?: ReactNode;
    // ChartDataPoint[] 호환을 위한 data prop 타입
    data?: ChartDataPoint[];
  }

  // Legend 컴포넌트 타입 확장
  interface LegendProps {
    formatter?: (
      value: string,
      entry: LegendEntry,
      index: number
    ) => React.ReactNode;
  }
}
