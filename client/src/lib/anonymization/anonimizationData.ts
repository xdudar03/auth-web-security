import { faker } from '@faker-js/faker';
import { differenceInYears, parseISO } from 'date-fns';
const ageRanges = [
  {
    min: 0,
    max: 20,
    range: '0-20',
  },
  {
    min: 21,
    max: 40,
    range: '21-40',
  },
  {
    min: 41,
    max: 60,
    range: '41-60',
  },
  {
    min: 61,
    max: 80,
    range: '61-80',
  },
];

// for age, address, city, state, country
export function ageGeneralization(dateOfBirth: string) {
  const age = differenceInYears(new Date(), parseISO(dateOfBirth));
  console.log('age', age);
  const ageRange = ageRanges.find(
    (range) => age >= range.min && age <= range.max
  );
  return ageRange?.range ?? 'Unknown';
}

// for name
export function namePseudonymization() {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  };
}

// for gender
export function suppression() {
  return '--';
}

// for spending
export function perturbation(value: string) {
  const range = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const valueNumber = parseInt(value);
  const randomValue = range[Math.floor(Math.random() * range.length)];
  const perturbedValue = valueNumber + valueNumber * randomValue;
  return perturbedValue.toString();
}

// for phone number, email, zip code
export function masking(value: string) {
  console.log('value', value);
  if (value.includes('@')) {
    // replace all characters before @ with *
    const beforeAt = value.split('@')[0];
    const afterAt = value.split('@')[1];
    return beforeAt.replace(/[a-zA-Z0-9]/g, '*') + '@' + afterAt;
  } else if (value.length === 5) {
    // in case of zip code, replace all digits with * except the first two digits
    const firstTwoDigits = value.slice(0, 2);
    const lastThreeDigits = value.slice(2);
    return firstTwoDigits + lastThreeDigits.replace(/\d/g, '*');
  } else if (value.startsWith('+')) {
    // in case of phone number, replace all digits with * except the first three digits
    const firstThreeDigits = value.slice(0, 3);
    const lastDigits = value.slice(3);
    return firstThreeDigits + lastDigits.replace(/\d/g, '*');
  } else {
    return value.replace(/\d/g, '*');
  }
}
