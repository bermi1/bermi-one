import { useMemo } from 'react';
import { useData } from '../state/DataContext';
import { T } from './i18n';
import { COUNTRIES, countryByCode, formatMoney, shortMoney } from './countries';

export function useSettings() {
  const { profile } = useData();
  const lang = profile?.lang || 'en';
  const theme = profile?.theme || 'light';
  const role = profile?.role || 'owner';
  const country = countryByCode(profile?.country_code || 'TZ');
  const L = T[lang];
  const owner = role === 'owner';

  const fmt = useMemo(() => (n: number) => formatMoney(n, country), [country]);
  const short = useMemo(() => (n: number) => shortMoney(n, country), [country]);

  return { lang, theme, role, owner, country, L, fmt, short, countries: COUNTRIES };
}
