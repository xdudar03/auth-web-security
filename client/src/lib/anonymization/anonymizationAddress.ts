import countries, { Country } from 'world-countries';

// Build a name/index map once
const byName = new Map<string, Country>();
countries.forEach((c: Country) => {
  const names = new Set<string>([
    c.name.common,
    c.name.official,
    ...(c.altSpellings || []),
    c.cca2,
    c.cca3,
  ]);
  names.forEach((n) => byName.set(n.toLowerCase(), c));
});

export function anonymizeCountry(input: string): string | undefined {
  return byName.get(input.toLowerCase())?.region;
}

export async function anonymizeStreet(street: string) {
  const q = street;
  const json = await fetchFromPhoton(q);
  return json.features.map(
    (f: {
      properties: {
        name: string;
        city: string;
        town: string;
        village: string;
        municipality: string;
      };
      geometry: { coordinates: [number, number] };
    }) => ({
      name: f.properties.name,
      city:
        f.properties.city ||
        f.properties.town ||
        f.properties.village ||
        f.properties.municipality,
    })
  );
}

async function fetchFromPhoton(value: string) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', value);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lang', 'en');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  console.log('json', json);
  return json;
}

export async function anonymizeCity(city: string) {
  const json = await fetchFromPhoton(city);
  return json.features.map(
    (f: {
      properties: {
        name: string;
        country: string;
      };
      geometry: { coordinates: [number, number] };
    }) => ({
      name: f.properties.name,
      country: f.properties.country,
    })
  );
}
