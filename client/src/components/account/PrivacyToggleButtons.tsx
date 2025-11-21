'use client';
import { Eye, EyeClosed, HatGlasses } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { PrivacySettings } from '@/hooks/useUserContext';

interface PrivacyToggleButtonsProps {
  fieldName: string;
  privacy: PrivacySettings[] | null;
  onToggle: (visibility: 'hidden' | 'anonymized' | 'visible') => Promise<void>;
}

export const PrivacyToggleButtons = ({
  fieldName,
  privacy,
  onToggle,
}: PrivacyToggleButtonsProps) => {
  const isVisible =
    privacy?.find((p: PrivacySettings) => p.field === fieldName)?.visibility ===
    'visible';

  return (
    <div className="flex gap-1">
      {isVisible ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void onToggle('hidden')}
            >
              <Eye />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Hide this field</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void onToggle('visible')}
            >
              <EyeClosed />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Show this field</p>
          </TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void onToggle('anonymized')}
          >
            <HatGlasses />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Anonymize this field</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
