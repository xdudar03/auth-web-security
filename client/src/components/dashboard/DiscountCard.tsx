'use client';

import { Card, CardContent } from '../ui/card';
import type { VisibilityStats } from '../../lib/privacyInsights';

type DiscountCardProps = {
  visibilityStats: VisibilityStats;
};

export default function DiscountCard({ visibilityStats }: DiscountCardProps) {
  return (
    <div className="col-span-1 h-full overflow-hidden">
      <Card className="h-full">
        <CardContent className="flex flex-col gap-2 text-sm">
          <h3 className="text-lg font-semibold text-center">Discount Tier</h3>
          <p className="text-sm text-muted-foreground">
            Current tier:{' '}
            <span className="font-semibold text-foreground">
              {visibilityStats.tier}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Discount:{' '}
            <span className="font-semibold text-foreground">
              {visibilityStats.discountRate}%
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            More visible fields increase discounts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
