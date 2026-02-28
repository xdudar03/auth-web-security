import { Shop, type User as UserType } from '@/hooks/useUserContext';
import type { FormValues } from './anonymization/anonymizationHandlers';
import type { AnonymizedValues } from './useAnonymizedBatchSync';

export const buildAccountFormValues = (
  source: Partial<UserType> | null,
  shops: Shop[] | null
): FormValues => ({
  username: source?.username ?? '',
  shops: shops?.map((shop: Shop) => shop.shopName) ?? [],
  firstName: source?.firstName ?? '',
  lastName: source?.lastName ?? '',
  email:
    (source as Partial<UserType> & { email?: string })?.email ??
    source?.emailHash ??
    '',
  phoneNumber: source?.phoneNumber ?? '',
  dateOfBirth: source?.dateOfBirth ?? '',
  gender: source?.gender ?? '',
  country: source?.country ?? '',
  city: source?.city ?? '',
  address: source?.address ?? '',
  zip: source?.zip ?? '',
  spendings: source?.spendings ?? '',
  shoppingHistory: source?.shoppingHistory ?? '',
});

export const parseDecryptedUserPayload = (
  decrypted: string
): Partial<UserType> => {
  try {
    return JSON.parse(decrypted) as Partial<UserType>;
  } catch {
    return { email: decrypted } as Partial<UserType>;
  }
};

export const parseDecryptedAnonymizedPayload = (
  decrypted: string
): AnonymizedValues => {
  try {
    return JSON.parse(decrypted) as AnonymizedValues;
  } catch {
    return {};
  }
};
