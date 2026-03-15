'use client';

import { Card, CardContent } from '../ui/card';

type TopShopCardProps = {
  topShopName: string | null;
};

export default function TopShopCard({ topShopName }: TopShopCardProps) {
  return (
    <div className="col-span-1 h-full overflow-hidden">
      <Card className="h-full">
        <CardContent className="flex flex-col gap-2 text-sm">
          <h3 className="text-lg font-semibold text-center">Top Shop</h3>
          <p className="text-sm text-muted-foreground">Most visited:</p>
          <p className="text-base font-semibold text-foreground">
            {topShopName ?? 'No visits yet'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
