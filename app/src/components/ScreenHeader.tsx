import { useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useScrolled } from '../lib/useScrolled';

/**
 * A phone app's header, not a web page's heading.
 *
 * A pinned bar holds the back button and actions; the page title sits large
 * beneath it. Scroll, and the large title slides away while a compact one
 * fades into the bar, which frosts over whatever passes under it — the way
 * native apps on both platforms do it.
 */
export function ScreenHeader({ title, sub, back, right }: { title: string; sub?: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const scrolled = useScrolled(ref, 30);
  return (
    <>
      <div ref={ref} className="appbar" data-scrolled={scrolled || undefined}>
        <div className="appbar-side">
          {back && (
            <button className="appbar-back tap" onClick={() => nav(-1)} aria-label="Back">
              <Icon name="left" size={19} />
            </button>
          )}
        </div>
        <div className="appbar-title" aria-hidden={!scrolled}>{title}</div>
        <div className="appbar-side appbar-right">{right}</div>
      </div>
      <div className="large-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
    </>
  );
}
