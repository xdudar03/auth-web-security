'use client';

import { Card, CardContent } from '../ui/card';
import type { PrivacySettings } from '@/hooks/useUserContext';
import { normalizeFieldName } from '../../lib/privacyInsights';

type VisibilityCardProps = {
  sortedSettings: PrivacySettings[];
};

export default function VisibilityCard({
  sortedSettings,
}: VisibilityCardProps) {
  return (
    <div className="xl:col-span-2 h-full">
      <Card className="h-full overflow-y-scroll scrollbar-soft">
        <CardContent className="flex flex-col gap-2 text-sm">
          <h3 className="text-lg font-semibold text-center">
            Field Visibility Configuration
          </h3>
          {sortedSettings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No privacy configuration available yet.
            </p>
          ) : (
            <div className="flex flex-col">
              {sortedSettings.map((setting) => (
                <div
                  key={setting.field}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-border/20 last:border-b-0"
                >
                  <span className="text-sm text-muted-foreground">
                    {normalizeFieldName(setting.field)}
                  </span>
                  <span className="text-sm font-medium text-foreground capitalize">
                    {setting.visibility}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
