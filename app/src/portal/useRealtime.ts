import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type LiveStatus = 'live' | 'connecting' | 'off';

/**
 * Watch a table and react to every insert as it lands.
 *
 * Realtime honours row level security, so the portal receives exactly the rows
 * a platform administrator is allowed to select — the same policies that guard
 * the REST reads. That is why the admin read policies exist: without them this
 * subscribes successfully and then stays silent forever, which is the hardest
 * kind of failure to notice.
 *
 * The handler is held in a ref so a caller can pass an inline closure without
 * tearing down and rebuilding the channel on every render.
 */
export function useRealtimeInserts<T>(table: string, onInsert: (row: T) => void, enabled = true): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('connecting');
  const handler = useRef(onInsert);
  handler.current = onInsert;

  useEffect(() => {
    if (!enabled) { setStatus('off'); return; }
    setStatus('connecting');

    const channel = supabase
      .channel(`hq:${table}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload) => {
        handler.current(payload.new as T);
      })
      .subscribe((state) => {
        setStatus(state === 'SUBSCRIBED' ? 'live' : state === 'CLOSED' ? 'off' : 'connecting');
      });

    return () => { void supabase.removeChannel(channel); };
  }, [table, enabled]);

  return status;
}
