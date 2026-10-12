import { Component, type ReactNode } from 'react';
import { isStaleChunk, reloadForNewVersion } from '../lib/routeChunks';

/**
 * One screen failing must not take the whole app with it.
 *
 * Without a boundary, any error while a page renders — or while its code is
 * fetched — unmounts everything above it, navigation included, and leaves a
 * white page. This keeps the shell standing, says what happened, and clears
 * itself the moment the person goes to another page (`resetKey`).
 */
export class ScreenBoundary extends Component<{ resetKey: string; sw?: boolean; children: ReactNode }, { error: unknown; key: string }> {
  state = { error: null as unknown, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { error: unknown; key: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown) {
    // A screen from the previous release: the new one is a reload away.
    if (isStaleChunk(error)) reloadForNewVersion();
    console.error('Screen failed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const sw = this.props.sw;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return (
      <div className="screen" role="alert" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ padding: 22, maxWidth: 360, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{sw ? 'Ukurasa huu haukufunguka' : 'This page did not open'}</div>
          <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 6, lineHeight: 1.5 }}>
            {offline
              ? (sw ? 'Hakuna mtandao. Unganisha kisha ujaribu tena.' : 'You are offline. Reconnect and try again.')
              : (sw ? 'Huenda kuna toleo jipya la Bermi One. Fungua upya ili kulipata — hakuna kilichopotea.' : 'A new version of Bermi One may be out. Reload to get it — nothing you recorded is lost.')}
          </div>
          <button type="button" className="btn-primary tap" style={{ width: '100%', marginTop: 14, border: 'none' }} onClick={() => window.location.reload()}>
            {sw ? 'Fungua upya' : 'Reload'}
          </button>
        </div>
      </div>
    );
  }
}
