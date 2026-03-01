import type { FormValues } from '@/lib/anonymization/anonymizationHandlers';
import type { Visibility } from '../../../server/src/types/privacySetting';

export const providerShareFields: Array<keyof FormValues> = [
  'username',
  'email',
  'firstName',
  'lastName',
  'phoneNumber',
  'dateOfBirth',
  'gender',
  'country',
  'city',
  'address',
  'zip',
];

export type ProviderAccessMode = 'hidden' | 'anonymized' | 'visible';

export type AnonymizedSnapshot = Partial<
  Record<keyof FormValues, FormValues[keyof FormValues]>
>;

export type PrivacyEntry = {
  field: string;
  visibility: Visibility;
};

export const buildPrivacyMapWithOverride = (
  privacy: PrivacyEntry[],
  override?: { field: string; visibility: Visibility }
) => {
  const map: Record<string, Visibility> = {};

  privacy.forEach((item) => {
    map[item.field] = item.visibility;
  });

  if (override) {
    map[override.field] = override.visibility;
  }

  return map;
};

const toShareString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value);
};

export const buildProviderPayload = (
  userId: string,
  formValues: FormValues,
  providerVisibleValues: FormValues | null,
  anonymizedSnapshot: AnonymizedSnapshot,
  privacyMap: Record<string, Visibility>
): {
  mode: ProviderAccessMode;
  payload: Record<string, string>;
} => {
  let hasVisibleField = false;
  let hasAnonymizedField = false;

  const payload: Record<string, string> = {
    userId,
  };

  providerShareFields.forEach((field) => {
    const visibility = privacyMap[field] ?? 'hidden';

    if (visibility === 'visible') {
      hasVisibleField = true;
      const visibleValue = providerVisibleValues?.[field] ?? formValues[field] ?? '';
      payload[field] = toShareString(visibleValue);
      return;
    }

    if (visibility === 'anonymized') {
      hasAnonymizedField = true;
      payload[field] = toShareString(anonymizedSnapshot[field]);
      return;
    }

    payload[field] = '';
  });

  const mode: ProviderAccessMode = hasVisibleField
    ? 'visible'
    : hasAnonymizedField
      ? 'anonymized'
      : 'hidden';

  return {
    mode,
    payload,
  };
};

export const buildVisibilitySignature = (
  privacyMap: Record<string, Visibility>
) => {
  return providerShareFields
    .map((field) => `${field}:${privacyMap[field] ?? 'hidden'}`)
    .join('|');
};

export const hasAnySharedField = (privacyMap: Record<string, Visibility>) => {
  return providerShareFields.some(
    (field) => (privacyMap[field] ?? 'hidden') !== 'hidden'
  );
};
