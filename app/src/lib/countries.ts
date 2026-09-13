export interface Country {
  code: string;
  name: string;
  cur: string;
  sym: string;
  rate: number; // relative to TZS
}

export const COUNTRIES: Country[] = [
  { code: 'TZ', name: 'Tanzania', cur: 'TZS', sym: 'TSh', rate: 1 },
  { code: 'KE', name: 'Kenya', cur: 'KES', sym: 'KSh', rate: 0.055 },
  { code: 'UG', name: 'Uganda', cur: 'UGX', sym: 'USh', rate: 1.45 },
  { code: 'NG', name: 'Nigeria', cur: 'NGN', sym: '₦', rate: 0.62 },
  { code: 'GH', name: 'Ghana', cur: 'GHS', sym: 'GH₵', rate: 0.0055 },
  { code: 'ZA', name: 'South Africa', cur: 'ZAR', sym: 'R', rate: 0.0072 },
  { code: 'US', name: 'United States', cur: 'USD', sym: '$', rate: 0.00038 },
];

export function countryByCode(code: string): Country {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}

export function formatMoney(n: number, country: Country): string {
  const v = n * country.rate;
  const d = country.rate < 0.01 ? 2 : 0;
  return country.sym + ' ' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function shortMoney(n: number, country: Country): string {
  const v = Math.abs(n * country.rate);
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return Math.round(v / 1e3) + 'k';
  return Math.round(v).toString();
}
