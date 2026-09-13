import { useMemo } from 'react';
import { useData } from '../state/DataContext';
import { T } from './i18n';
import { COUNTRIES, countryByCode, formatMoney, shortMoney } from './countries';

export function useSettings() {
  const { profile, activeBusiness } = useData();
  const lang = profile?.lang || 'en';
  const theme = profile?.theme || 'light';
  const role = profile?.role || 'owner';
  const country = countryByCode(activeBusiness?.country_code || 'TZ');
  const L = T[lang];
  const owner = role === 'owner';

  const fmt = useMemo(() => (n: number) => formatMoney(n, country), [country]);
  const short = useMemo(() => (n: number) => shortMoney(n, country), [country]);

  // A screen full of "TSh 0" reads as noise, and worse, as though a real zero
  // was recorded. Nothing counted yet shows as a dash instead.
  const fmt0 = useMemo(() => (n: number) => (n ? formatMoney(n, country) : '—'), [country]);
  const num0 = useMemo(() => (n: number) => (n ? String(n) : '—'), []);

  return { lang, theme, role, owner, country, L, fmt, short, fmt0, num0, countries: COUNTRIES };
}
