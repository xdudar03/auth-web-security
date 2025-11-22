'use client';
import { FormInputField } from './FormInputField';
import { Control } from 'react-hook-form';
import { PrivacySettings } from '@/hooks/useUserContext';
import { FormValues } from './anonymizationHandlers';
import PrivacyLevelsToggle from './PrivacyLevelsToggle';

interface PersonalDetailsSectionProps {
  control: Control<FormValues>;
  isViewMode: boolean;
  privacy: PrivacySettings[] | null;
  messages: Record<string, string>;
  onToggleVisibility: (
    field: string,
    visibility: 'hidden' | 'anonymized' | 'visible'
  ) => Promise<void>;
}

export const PersonalDetailsSection = ({
  control,
  isViewMode,
  privacy,
  messages,
  onToggleVisibility,
}: PersonalDetailsSectionProps) => {
  return (
    <div className="grid-section-2 w-full">
      <div className="flex flex-row gap-2 items-center justify-between col-span-2">
        <h1 className="text-lg font-bold">Personal Details</h1>
        <PrivacyLevelsToggle />
      </div>
      <FormInputField
        control={control}
        label="First Name"
        name="firstName"
        type="text"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['firstName']}
        onToggleVisibility={onToggleVisibility}
      />
      <FormInputField
        control={control}
        label="Last Name"
        name="lastName"
        type="text"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['lastName']}
        onToggleVisibility={onToggleVisibility}
      />
      <FormInputField
        control={control}
        label="Email"
        name="email"
        type="email"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['email']}
        onToggleVisibility={onToggleVisibility}
      />
      <FormInputField
        control={control}
        label="Phone Number"
        name="phoneNumber"
        type="tel"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['phoneNumber']}
        onToggleVisibility={onToggleVisibility}
      />
      <FormInputField
        control={control}
        label="Date of Birth"
        name="dateOfBirth"
        type="date"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['dateOfBirth']}
        onToggleVisibility={onToggleVisibility}
      />
      <FormInputField
        control={control}
        label="Gender"
        name="gender"
        type="text"
        disabled={isViewMode}
        privacy={privacy}
        message={messages['gender']}
        onToggleVisibility={onToggleVisibility}
      />
    </div>
  );
};
