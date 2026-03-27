import { CircleQuestionMark } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { Switch } from '../ui/switch';

export default function AnonymizationSwitch({
  anonymizeImage,
  setAnonymizeImage,
}: {
  anonymizeImage: boolean;
  setAnonymizeImage: (checked: boolean) => void;
}) {
  const handleAnonymizeImage = (checked: boolean) => {
    setAnonymizeImage(checked);
  };

  return (
    <div className="w-full rounded-lg border border-border/70 bg-background/60 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Anonymize image</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="rounded-full text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="What anonymize image does"
                >
                  <CircleQuestionMark className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-64 text-sm whitespace-pre-line">
                  Anonymizing the image removes sensitive visual details before
                  processing. Keep this enabled for better privacy.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted">Recommended for daily use.</p>
        </div>
        <Switch
          checked={anonymizeImage}
          onCheckedChange={handleAnonymizeImage}
        />
      </div>
    </div>
  );
}
