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

export async function handleFieldAnonymization(
  fieldName: string,
  formGetValues: (field: keyof FormValues) => string | undefined,
  formSetValue: UseFormSetValue<FormValues>,
  setMessages: (
    callback: (prev: Record<string, string>) => Record<string, string>
  ) => void
) {
  switch (fieldName) {
    case 'firstName':
      const anonFirstName = namePseudonymization().firstName;
      setMessages((prev) => ({
        ...prev,
        [fieldName]: 'Anonymized value: ' + anonFirstName,
      }));
      formSetValue('firstName', anonFirstName);
      break;
    case 'lastName':
      const anonLastName = namePseudonymization().lastName;
      setMessages((prev) => ({
        ...prev,
        [fieldName]: 'Anonymized value: ' + anonLastName,
      }));
      formSetValue('lastName', anonLastName);
      break;
    case 'email':
      const anonEmail = masking(formGetValues('email') ?? '');
      setMessages((prev) => ({
        ...prev,
        [fieldName]: 'Anonymized value: ' + anonEmail,
      }));
      formSetValue('email', anonEmail);
      break;
    case 'phoneNumber':
      const anonPhone = masking(formGetValues('phoneNumber') ?? '');
      setMessages((prev) => ({
        ...prev,
        [fieldName]: 'Anonymized value: ' + anonPhone,
      }));
      formSetValue('phoneNumber', anonPhone);
      break;
    case 'dateOfBirth':
      const dateOfBirth = formGetValues('dateOfBirth') ?? '';
      const anonDOB = ageGeneralization(dateOfBirth);
      setMessages((prev) => ({
        ...prev,
        [fieldName]: 'Anonymized value: ' + anonDOB,
      }));
      formSetValue('dateOfBirth', anonDOB);
      break;
    case 'gender':
      const anonGender = suppression();
      setMessages((prev) => ({
        ...prev,
        [fieldName]: 'Anonymized value: ' + anonGender,
      }));
      formSetValue('gender', anonGender);
      break;
    case 'zip':
      const anonZip = masking(formGetValues('zip') ?? '');
      setMessages((prev) => ({
        ...prev,
        [fieldName]: 'Anonymized value: ' + anonZip,
      }));
      formSetValue('zip', anonZip);
      break;
    case 'country':
      const country = formGetValues('country') ?? '';
      const anonymizedCountry = anonymizeCountry(country);
      console.log('anonymizedCountry', anonymizedCountry);
      if (anonymizedCountry) {
        setMessages((prev) => ({
          ...prev,
          [fieldName]: 'Anonymized value: ' + anonymizedCountry,
        }));
      } else {
        setMessages((prev) => ({ ...prev, [fieldName]: 'No country found' }));
      }
      formSetValue('country', anonymizedCountry ?? null);
      break;
    case 'city':
      const city = formGetValues('city') ?? '';
      const anonymizedCity = await anonymizeCity(city);
      console.log('anonymizedCity', anonymizedCity);
      if (anonymizedCity.length > 0) {
        setMessages((prev) => ({
          ...prev,
          [fieldName]: 'Anonymized value: ' + anonymizedCity[0].country,
        }));
      } else {
        setMessages((prev) => ({ ...prev, [fieldName]: 'No city found' }));
      }
      formSetValue('city', anonymizedCity[0].country);
      break;
    case 'address':
      const street = formGetValues('address') ?? '';
      const cityValue = formGetValues('city') ?? '';
      const anonymizedStreet = await anonymizeStreet(street, cityValue);
      console.log('anonymizedStreet', anonymizedStreet);
      if (anonymizedStreet.length > 0) {
        setMessages((prev) => ({
          ...prev,
          [fieldName]: 'Anonymized value: ' + anonymizedStreet[0].city,
        }));
      } else {
        setMessages((prev) => ({ ...prev, [fieldName]: 'No street found' }));
      }
      formSetValue('address', anonymizedStreet[0].city);
      break;
  }
}
