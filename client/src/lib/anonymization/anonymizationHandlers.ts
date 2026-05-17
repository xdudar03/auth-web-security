import {
  masking,
  namePseudonymization,
  suppression,
  ageGeneralization,
} from '@/lib/anonymization/anonimizationData';
import {
  anonymizeCity,
  anonymizeCountry,
  anonymizeStreet,
} from '@/lib/anonymization/anonymizationAddress';
import { UseFormSetValue } from 'react-hook-form';

export type FormValues = {
  username: string;
  shops: string[];
  firstName: string | null;
  lastName: string | null;
  email: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  zip: string | null;
  spendings: string | null;
  shoppingHistory: string | null;
};

export type AnonymizedValues = Partial<
  Record<keyof FormValues, FormValues[keyof FormValues]>
>;

type FormValueGetter = (
  field: keyof FormValues
) => FormValues[keyof FormValues] | undefined;

type PrivacySettingForAnonymization = {
  field: string;
  visibility: 'hidden' | 'anonymized' | 'visible';
};

const asString = (value: FormValues[keyof FormValues] | undefined) => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value ?? '';
};

export const formatAnonymizedValue = (
  value: FormValues[keyof FormValues] | undefined
) => (Array.isArray(value) ? value.join(', ') : value);

export async function anonymizeFieldValue(
  fieldName: string,
  formGetValues: FormValueGetter
): Promise<FormValues[keyof FormValues] | undefined> {
  switch (fieldName) {
    case 'username':
      return 'hidden-user';
    case 'firstName':
      return namePseudonymization().firstName;
    case 'lastName':
      return namePseudonymization().lastName;
    case 'email':
      return masking(asString(formGetValues('email')));
    case 'phoneNumber':
      return masking(asString(formGetValues('phoneNumber')));
    case 'dateOfBirth':
      return ageGeneralization(asString(formGetValues('dateOfBirth')));
    case 'gender':
      return suppression();
    case 'zip':
      return masking(asString(formGetValues('zip')));
    case 'country':
      return anonymizeCountry(asString(formGetValues('country'))) ?? 'anonymous';
    case 'city': {
      const city = asString(formGetValues('city'));
      if (!city) return 'anonymous';

      try {
        const anonymizedCity = await anonymizeCity(city);
        return anonymizedCity[0]?.country ?? 'anonymous';
      } catch {
        return 'anonymous';
      }
    }
    case 'address': {
      const street = asString(formGetValues('address'));
      const city = asString(formGetValues('city'));
      if (!street) return 'anonymous';

      try {
        const anonymizedStreet = await anonymizeStreet(street, city);
        return anonymizedStreet[0]?.city ?? 'anonymous';
      } catch {
        return 'anonymous';
      }
    }
    case 'spendings':
      return '***';
    case 'shoppingHistory':
      return '[]';
    case 'shops':
      return [];
    default:
      return undefined;
  }
}

export async function buildAnonymizedSnapshotForSettings(
  settings: PrivacySettingForAnonymization[],
  formGetValues: FormValueGetter
): Promise<{
  snapshot: AnonymizedValues;
  messages: Record<string, string>;
}> {
  const snapshot: AnonymizedValues = {};
  const messages: Record<string, string> = {};

  for (const { field, visibility } of settings) {
    if (visibility !== 'anonymized') {
      continue;
    }

    const anonymizedValue = await anonymizeFieldValue(field, formGetValues);
    if (anonymizedValue === undefined) {
      continue;
    }

    snapshot[field as keyof FormValues] = anonymizedValue;
    messages[field] = `Anonymized value: ${formatAnonymizedValue(
      anonymizedValue
    )}`;
  }

  return { snapshot, messages };
}

export async function handleFieldAnonymization(
  fieldName: string,
  formGetValues: FormValueGetter,
  formSetValue: UseFormSetValue<FormValues>,
  setMessages: (
    callback: (prev: Record<string, string>) => Record<string, string>
  ) => void
) {
  const field = fieldName as keyof FormValues;
  const anonymizedValue = await anonymizeFieldValue(field, formGetValues);
  if (anonymizedValue === undefined) {
    return;
  }

  setMessages((prev) => ({
    ...prev,
    [fieldName]: `Anonymized value: ${formatAnonymizedValue(anonymizedValue)}`,
  }));
  formSetValue(field, anonymizedValue);
}
