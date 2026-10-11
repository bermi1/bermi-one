import { Icon } from '../lib/icons';
import { BUSINESS_TYPES, tintVars } from '../lib/types';

/**
 * Which kind of business this is — the one picker used everywhere a type is
 * chosen (onboarding, adding a business, the business profile).
 *
 * The modules that are built get a real card saying what they do; the rest are
 * listed underneath as what is coming, plainly not selectable.
 */
export function BusinessTypePicker({ value, onChange, lang }: { value: string; onChange: (id: string) => void; lang: 'en' | 'sw' | string }) {
  const sw = lang === 'sw';
  const live = BUSINESS_TYPES.filter((b) => b.live);
  const soon = BUSINESS_TYPES.filter((b) => !b.live && b.id !== 'other');
  return (
    <div>
      <div className="section-label" style={{ marginTop: 0 }}>{sw ? 'Inapatikana sasa' : 'Available now'}</div>
      <div className="type-grid">
        {live.map((b, i) => {
          const on = value === b.id;
          const tv = tintVars(i);
          return (
            <button key={b.id} type="button" className="type-card tap" aria-pressed={on} onClick={() => onChange(b.id)}>
              <span className="type-icon" style={{ background: on ? 'var(--brand)' : tv.soft, color: on ? '#fff' : tv.ink }}><Icon name={b.icon} size={18} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="type-name">{sw ? b.nameSw : b.name}</span>
                <span className="type-desc">{sw ? b.descSw : b.desc}</span>
              </span>
              <span className="type-radio" aria-hidden>{on && <Icon name="check" size={12} />}</span>
            </button>
          );
        })}
      </div>
      <div className="section-label">{sw ? 'Zinakuja hivi karibuni' : 'Coming soon'}</div>
      <div className="type-soon">
        {soon.map((b) => (
          <span key={b.id} aria-disabled><Icon name={b.icon} size={12} /> {sw ? b.nameSw : b.name}</span>
        ))}
      </div>
    </div>
  );
}
