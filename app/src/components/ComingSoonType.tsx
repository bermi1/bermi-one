import { Icon } from '../lib/icons';

/**
 * A business type that is on the roadmap but not built yet. Bar is the only
 * module with a real closing sheet, template and reports behind it, so the
 * others are shown — people should see where this is going — but they are
 * plainly marked and cannot be selected.
 */
export function ComingSoonType({ name, icon, label, compact }: { name: string; icon: string; label: string; compact?: boolean }) {
  return (
    <div
      aria-disabled
      style={{
        padding: compact ? '10px 12px' : '13px 14px',
        borderRadius: compact ? 14 : 16,
        background: 'var(--card2)',
        border: '1px dashed var(--line)',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 10,
        opacity: 0.55,
        cursor: 'not-allowed',
      }}
    >
      {!compact && (
        <div style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--card)', color: 'var(--ink3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={14} />
        </div>
      )}
      {compact && <Icon name={icon} size={14} style={{ color: 'var(--ink3)', flexShrink: 0 }} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12.5 : 13, fontWeight: 700, color: 'var(--ink2)' }}>{name}</div>
        <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}
