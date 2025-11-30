import { CircleQuestionMark } from 'lucide-react';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/hooks/TrpcContext';
import { useState } from 'react';

export default function PrivacyLevelsToggle() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState({
    message: '',
    type: '',
  });

  const getUserPrivacyPresetQuery = useQuery(
    trpc.privacy.getUserPrivacyPreset.queryOptions()
  );
  const userPrivacyPreset = getUserPrivacyPresetQuery.data ?? '';
  console.log('userPrivacyPreset', userPrivacyPreset);

  const getAllPrivacyPresetsQuery = useQuery(
    trpc.privacy.getAllPrivacyPresets.queryOptions()
  );

  const applyPrivacyPresetMutation = useMutation(
    trpc.privacy.applyPrivacyPreset.mutationOptions({
      onSuccess: (data) => {
        console.log('data', data);
        queryClient.invalidateQueries({
          queryKey: trpc.info.getUserInfo.queryOptions().queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: trpc.privacy.getUserPrivacyPreset.queryOptions().queryKey,
        });
        setMessage({
          message: 'Privacy preset applied successfully',
          type: 'success',
        });
        setTimeout(() => {
          setMessage({ message: '', type: '' });
        }, 3000);
      },
      onError: (error) => {
        console.error('Error applying privacy preset', error);
        setMessage({
          message: 'Error applying privacy preset',
          type: 'error',
        });
        setTimeout(() => {
          setMessage({ message: '', type: '' });
        }, 3000);
      },
    })
  );

  const handleApplyPrivacyPreset = (preset: string) => {
    console.log('preset', preset);
    applyPrivacyPresetMutation.mutate({ preset: preset.toLowerCase() });
  };

  const privacyPresets = getAllPrivacyPresetsQuery.data ?? [];
  console.log('privacyPresets', privacyPresets);
  return (
    <div className="flex items-center gap-3 flex-col">
      <div className="flex items-center gap-3 flex-row">
        <HoverCard openDelay={100} closeDelay={100}>
          <HoverCardTrigger asChild>
            <CircleQuestionMark className="h-6 w-6 cursor-pointer hover:text-primary" />
          </HoverCardTrigger>
          <HoverCardContent className="w-[22rem] space-y-4 rounded-lg border border-border bg-surface p-4 text-sm shadow-lg">
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Privacy presets</p>
              <p className="text-muted-foreground">
                Choose how much of your personal data providers can access.
                Higher presets automatically anonymize or hide more fields. The
                default preset is PL4 (Privacy Level 4).
              </p>
            </div>
            <ul className="space-y-2">
              {privacyPresets.map(({ label, description }) => (
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
          value={userPrivacyPreset ? userPrivacyPreset.toUpperCase() : ''}
          size="sm"
          spacing={0}
          className="rounded-md border border-border bg-surface p-0.5 shadow-xs"
        >
          {privacyPresets.map(({ label }) => (
            <ToggleGroupItem
              key={label}
              value={label}
              className="privacy-toggle-button"
              onClick={() => handleApplyPrivacyPreset(label)}
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {message.message && (
        // add sonner component
        <p
          className={`text-sm ${
            message.type === 'success' ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {message.message}
        </p>
      )}
    </div>
  );
}
