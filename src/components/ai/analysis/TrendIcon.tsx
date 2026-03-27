import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';

export function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'increasing':
      return <ArrowUp className="h-4 w-4 text-red-500" />;
    case 'decreasing':
      return <ArrowDown className="h-4 w-4 text-green-500" />;
    default:
      return <ArrowRight className="h-4 w-4 text-gray-400" />;
  }
}
