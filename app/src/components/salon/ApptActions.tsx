import { Sheet } from '../Sheet';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { haptic } from '../../lib/haptics';
import { hhmm, waLink, type SalonAppointment } from '../../lib/salon';

/** Everything you can do to one booking, from one sheet. */
export function ApptActions({ appt, onClose, onCheckout }: { appt: SalonAppointment | null; onClose: () => void; onCheckout: (a: SalonAppointment) => void }) {
  const { lang, fmt } = useSettings();
  const sw = lang === 'sw';
  const { activeBusiness } = useData();
  const { setAppointmentStatus } = useSalon();
  if (!appt) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const when = new Date(appt.start_at);
  const day = when.toLocaleDateString(sw ? 'sw-TZ' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const shop = activeBusiness?.name || 'Bermi';
  const confirmText = sw
    ? `Habari ${appt.client_name}, miadi yako ${shop} imethibitishwa: ${day} saa ${hhmm(appt.start_at)} — ${appt.service_names || ''}. Karibu!`
    : `Hi ${appt.client_name}, your booking at ${shop} is confirmed: ${day} at ${hhmm(appt.start_at)} — ${appt.service_names || ''}. See you then!`;
  const remindText = sw
    ? `Habari ${appt.client_name}, tunakukumbusha miadi yako ${shop} ${day} saa ${hhmm(appt.start_at)}. Tafadhali tujulishe kama huwezi kuja.`
    : `Hi ${appt.client_name}, a reminder of your appointment at ${shop} on ${day} at ${hhmm(appt.start_at)}. Let us know if you can't make it.`;

  async function set(status: SalonAppointment['status']) {
    haptic();
    await setAppointmentStatus(appt!.id, status);
    onClose();
  }

  const btn = (label: string, icon: string, onClick: () => void, tone?: 'primary' | 'bad') => (
    <button type="button" className={tone === 'primary' ? 'btn-primary tap' : 'btn-ghost tap'} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px 14px', border: tone === 'primary' ? 'none' : undefined, color: tone === 'bad' ? 'var(--bad)' : undefined }}>
      <Icon name={icon} size={15} /> {label}
    </button>
  );

  const live = ['requested', 'confirmed', 'arrived'].includes(appt.status);

  return (
    <Sheet open={!!appt} onClose={onClose} title={appt.client_name} sub={`${day} · ${hhmm(appt.start_at)}–${hhmm(appt.end_at)}`}>
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5 }}>
        <div><b>{sw ? 'Huduma' : 'Services'}:</b> {appt.service_names || '—'}{appt.price_estimate ? ` · ~${fmt(appt.price_estimate)}` : ''}</div>
        <div><b>{sw ? 'Kinyozi' : 'Barber'}:</b> {appt.barber_name || (sw ? 'Yeyote' : 'Any')}</div>
        {appt.client_phone && <div><b>{sw ? 'Mobile' : 'Phone'}:</b> {appt.client_phone}</div>}
        <div><b>{sw ? 'Chanzo' : 'Source'}:</b> {appt.source === 'online' ? (sw ? 'Mtandaoni' : 'Online') : appt.source === 'phone' ? (sw ? 'Mobile' : 'Phone') : (sw ? 'Ana kwa ana' : 'Walk-in')}</div>
        {appt.note && <div style={{ color: 'var(--ink2)' }}>“{appt.note}”</div>}
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
        {appt.status === 'requested' && btn(sw ? 'Thibitisha miadi' : 'Confirm booking', 'check', () => set('confirmed'), 'primary')}
        {appt.status === 'confirmed' && btn(sw ? 'Amefika' : 'Client has arrived', 'user', () => set('arrived'), 'primary')}
        {appt.status === 'arrived' && btn(sw ? 'Lipisha' : 'Check out', 'wallet', () => onCheckout(appt), 'primary')}
        {appt.client_phone && live && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {btn(appt.status === 'requested' ? (sw ? 'Tuma uthibitisho' : 'Send confirmation') : (sw ? 'Kumbusha' : 'Remind'), 'chat', () => window.open(waLink(appt.client_phone, appt.status === 'requested' ? confirmText : remindText, activeBusiness?.country_code), '_blank'))}
            {btn(sw ? 'Piga simu' : 'Call', 'phone', () => { window.location.href = `tel:${appt.client_phone}`; })}
          </div>
        )}
        {live && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {btn(sw ? 'Hakuja' : 'No-show', 'alert', () => set('no_show'), 'bad')}
            {btn(sw ? 'Ghairi' : 'Cancel', 'x', () => set('cancelled'), 'bad')}
          </div>
        )}
      </div>
    </Sheet>
  );
}
