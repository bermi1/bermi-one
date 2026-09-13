import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';

export function ScreenHeader({ title, sub, back, right }: { title: string; sub?: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {back && (
          <button className="icon-btn tap" onClick={() => nav(-1)} aria-label="Back" style={{ marginTop: 1 }}>
            <Icon name="left" />
          </button>
        )}
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: 'var(--ink)' }}>{title}</div>
          {sub && <div style={{ marginTop: 3, fontSize: 13, color: 'var(--ink2)', fontWeight: 500 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}
