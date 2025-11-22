import { HelpCircle } from 'lucide-react';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';

const PRIVACY_LEVEL_OPTIONS = [
  { value: 'pl1', label: 'PL1' },
  { value: 'pl2', label: 'PL2' },
  { value: 'pl3', label: 'PL3' },
  { value: 'pl4', label: 'PL4' },
] as const;

const PRIVACY_TOGGLE_ITEM_CLASS =
  'min-w-[3.25rem] border border-transparent px-3 text-sm font-semibold uppercase tracking-wide text-muted transition-colors hover:bg-muted/10 hover:text-foreground data-[state=on]:border-primary/40 data-[state=on]:bg-primary/15 data-[state=on]:text-primary';

const PRIVACY_LEVEL_DESCRIPTIONS = [
  {
    label: 'Privacy Level 1',
    description: 'Lowest privacy level. Provider can see all data.',
  },
  {
    label: 'Privacy Level 2',
    description:
      'Medium privacy level. Sensitive data is anonymized so providers see less detail.',
  },
  {
    label: 'Privacy Level 3',
    description:
      'Higher privacy level. Most data is anonymized and sensitive fields are hidden.',
  },
  {
    label: 'Privacy Level 4',
    description: 'Highest privacy level. All data is hidden from providers.',
  },
] as const;

export default function PrivacyLevelsToggle() {
  return (
    <div className="flex items-center gap-3">
      <HoverCard>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-surface text-muted-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Privacy level help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </HoverCardTrigger>
        <HoverCardContent className="w-[22rem] space-y-4 rounded-lg border border-border bg-surface p-4 text-sm shadow-lg">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Privacy presets</p>
            <p className="text-muted-foreground">
              Choose how much of your personal data providers can access. Higher
              presets automatically anonymize or hide more fields.
            </p>
          </div>
          <ul className="space-y-2">
            {PRIVACY_LEVEL_DESCRIPTIONS.map(({ label, description }) => (
              <li
                key={label}
                className="rounded-md border border-border/60 bg-muted/40 p-2"
              >
                <span className="block text-xs font-semibold uppercase text-foreground">
                  {label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {description}
                </span>
              </li>
            ))}
          </ul>
        </HoverCardContent>
      </HoverCard>
      <ToggleGroup
        type="single"
        defaultValue={PRIVACY_LEVEL_OPTIONS[0].value}
        size="sm"
        spacing={0}
        className="rounded-md border border-border bg-surface p-0.5 shadow-xs"
      >
        {PRIVACY_LEVEL_OPTIONS.map(({ value, label }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className={PRIVACY_TOGGLE_ITEM_CLASS}
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
