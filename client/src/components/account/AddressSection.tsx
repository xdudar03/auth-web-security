'use client';
import { FormInputField } from './FormInputField';
import { Control } from 'react-hook-form';
import { PrivacySettings } from '@/hooks/useUserContext';
import { FormValues } from '../../lib/anonymization/anonymizationHandlers';

interface AddressSectionProps {
  control: Control<FormValues>;
  isViewMode: boolean;
  privacy: PrivacySettings[] | null;
  messages: Record<string, string>;
  onToggleVisibility: (
    field: string,
    visibility: 'hidden' | 'anonymized' | 'visible'
  ) => Promise<void>;
}

export const AddressSection = ({
  control,
  isViewMode,
  privacy,
  messages,
  onToggleVisibility,
}: AddressSectionProps) => {
  return (
    <div className="grid-section-2 w-full">
      <h1 className="text-lg font-bold col-span-2">Address</h1>
      <FormInputField
        control={control}
        label="Country"
        name="country"
        type="text"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['country']}
        onToggleVisibility={onToggleVisibility}
      />
      <FormInputField
        control={control}
        label="City"
        name="city"
        type="text"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['city']}
        onToggleVisibility={onToggleVisibility}
      />
      <FormInputField
        control={control}
        label="Address"
        name="address"
        type="text"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['address']}
        onToggleVisibility={onToggleVisibility}
      />
      <FormInputField
        control={control}
        label="Zip Code"
        name="zip"
        type="text"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['zip']}
        onToggleVisibility={onToggleVisibility}
      />
    </div>
  );
};
