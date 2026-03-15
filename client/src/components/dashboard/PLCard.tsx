'use client';
import { Card, CardContent } from '../ui/card';
import type { VisibilityStats } from '../../lib/privacyInsights';

type PLCardProps = {
  privacyPreset: string | null;
  visibilityStats: VisibilityStats;
};

export default function PLCard({
  privacyPreset,
  visibilityStats,
}: PLCardProps) {
  return (
    <div className="col-span-1 h-full overflow-hidden">
      <Card className="h-full">
        <CardContent className="flex flex-col gap-2 text-sm">
          <h3 className="text-lg font-semibold text-center">Privacy Preset</h3>
          <p className="text-sm text-muted-foreground">
            Level: <span className="font-semibold text-foreground">{privacyPreset ? privacyPreset.toUpperCase() : 'Not set yet'}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Controlled fields:{' '}
            <span className="font-semibold text-foreground">
              {visibilityStats.total}
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            Visible: {visibilityStats.visibleCount} | Anonymized:{' '}
            {visibilityStats.anonymizedCount} | Hidden:{' '}
            {visibilityStats.hiddenCount}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
