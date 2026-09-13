import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../lib/icons';

export function Sheet({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title?: string; sub?: string; children: ReactNode }) {
  if (!open) return null;
  return createPortal(
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)', margin: '4px auto 14px' }} />
        {(title || sub) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              {title && <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>}
              {sub && <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 3 }}>{sub}</div>}
            </div>
            <button className="icon-btn tap" onClick={onClose} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
