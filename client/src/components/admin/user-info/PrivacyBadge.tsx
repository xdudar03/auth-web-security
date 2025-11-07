import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Visibility = 'hidden' | 'anonymized' | 'visible';

export default function PrivacyBadge({
  visibility,
}: {
  visibility: Visibility;
}) {
  const variant: 'default' | 'destructive' | 'outline' =
    visibility === 'hidden'
      ? 'destructive'
      : visibility === 'anonymized'
      ? 'outline'
      : 'default';
  const label = visibility.charAt(0).toUpperCase() + visibility.slice(1);
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant={variant}>{label}</Badge>
      </TooltipTrigger>
      <TooltipContent>
        {visibility === 'visible' && 'Field is fully visible'}
        {visibility === 'anonymized' &&
          'Field is shown in a de-identified form'}
        {visibility === 'hidden' && 'Field is not visible to viewers'}
      </TooltipContent>
    </Tooltip>
  );
}
