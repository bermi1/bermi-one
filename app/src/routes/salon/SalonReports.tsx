import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Icon } from '../../lib/icons';
import { useSettings } from '../../lib/useSettings';
import { useData } from '../../state/DataContext';
import { useSalon } from '../../state/SalonContext';
import { barberLeaderboard, dailyRevenue, hourHeatmap, noShowRate, returningRate, serviceMix, type SalonAppointment, type SalonVisit } from '../../lib/salon';
import type { LedgerEntry } from '../../lib/types';

const PERIODS = [7, 30, 90] as const;

export function SalonReports() {
  const { lang, fmt, short } = useSettings();
  const sw = lang === 'sw';
  const nav = useNavigate();
  const { activeBusiness, fetchReportSource } = useData();
  const { fetchVisits, fetchAppointments } = useSalon();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<{ visits: SalonVisit[]; prev: SalonVisit[]; appts: SalonAppointment[]; ledger: LedgerEntry[] } | null>(null);

  useEffect(() => {
    if (!activeBusiness) return;
    const to = new Date();
    const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1));
    const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - days);
    setData(null);
    void Promise.all([
      fetchVisits(from.toISOString(), to.toISOString()),
      fetchVisits(prevFrom.toISOString(), from.toISOString()),
      fetchAppointments(from.toISOString(), to.toISOString()),
      fetchReportSource([activeBusiness.id], from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)),
    ]).then(([visits, prev, appts, src]) => setData({ visits, prev, appts, ledger: src.ledger }));
  }, [days, activeBusiness, fetchVisits, fetchAppointments, fetchReportSource]);

  const r = useMemo(() => {
    if (!data) return null;
    const paid = data.visits.filter((v) => v.status === 'paid');
    const revenue = paid.reduce((s, v) => s + v.total - v.tip, 0);
    const prevRevenue = data.prev.filter((v) => v.status === 'paid').reduce((s, v) => s + v.total - v.tip, 0);
    const tips = paid.reduce((s, v) => s + v.tip, 0);
    const commission = paid.reduce((s, v) => s + v.commission, 0);
    const discounts = paid.reduce((s, v) => s + v.discount, 0);
    const expenses = data.ledger.filter((l) => l.kind === 'expense' || l.kind === 'purchase').reduce((s, l) => s + Math.abs(l.amount), 0);
    const payouts = data.ledger.filter((l) => l.kind === 'expense' && l.label.startsWith('Payout · ')).reduce((s, l) => s + Math.abs(l.amount), 0);
    // Net: takings (tips excluded — they belong to the barbers) less the barbers' service
    // commission and other running costs. Payout expenses are not counted again: they are
    // the commission being handed over.
    const otherExpenses = expenses - payouts;
    const net = revenue - (commission - tips) - otherExpenses;
    const owed = Math.max(0, commission - payouts);
    return {
      revenue, prevRevenue, tips, commission, discounts, otherExpenses, net, owed,
      clients: paid.length, avg: paid.length ? Math.round(revenue / paid.length) : 0,
      growth: prevRevenue ? (revenue - prevRevenue) / prevRevenue : null,
      returning: returningRate(paid), noShow: noShowRate(data.appts),
      online: data.appts.filter((a) => a.source === 'online').length,
      daily: dailyRevenue(paid, days), barbers: barberLeaderboard(paid), services: serviceMix(paid), heat: hourHeatmap(paid),
    };
  }, [data, days]);

  function share() {
    if (!r) return;
    const lines = [
      `${activeBusiness?.name} — ${sw ? `siku ${days} zilizopita` : `last ${days} days`}`,
      `${sw ? 'Mapato' : 'Takings'}: ${fmt(r.revenue)}${r.growth !== null ? ` (${r.growth >= 0 ? '+' : ''}${Math.round(r.growth * 100)}%)` : ''}`,
      `${sw ? 'Wateja' : 'Clients'}: ${r.clients} · ${sw ? 'wastani' : 'avg'} ${fmt(r.avg)}`,
      `${sw ? 'Wanaorudi' : 'Returning'}: ${Math.round(r.returning * 100)}%`,
      r.barbers[0] ? `${sw ? 'Kinyozi bora' : 'Top barber'}: ${r.barbers[0].name} (${fmt(r.barbers[0].revenue)})` : '',
      r.services[0] ? `${sw ? 'Huduma bora' : 'Top service'}: ${r.services[0].name} ×${r.services[0].count}` : '',
      `— Bermi One`,
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank');
  }

  const maxDay = Math.max(1, ...(r?.daily.map((d) => d.revenue) || [1]));
  const maxHeat = Math.max(1, ...(r?.heat.flat() || [1]));
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

  return (
    <div className="screen sb desk-wide">
      <ScreenHeader title={sw ? 'Ripoti' : 'Reports'} sub={activeBusiness?.name}
        right={<button type="button" className="icon-btn tap" aria-label="WhatsApp" onClick={share}><Icon name="share" size={15} /></button>} />
      <div className="s-seg">
        {PERIODS.map((p) => <button key={p} type="button" aria-pressed={days === p} onClick={() => setDays(p)}>{sw ? `Siku ${p}` : `${p} days`}</button>)}
      </div>

      {!r ? <div className="skeleton" style={{ height: 320, marginTop: 12 }} /> : (
        <>
          <div className="s-kpis" style={{ marginTop: 12 }}>
            <div className="s-kpi"><span>{sw ? 'Mapato' : 'Takings'}</span><b>{short(r.revenue)}</b>
              {r.growth !== null && <span style={{ color: r.growth >= 0 ? 'var(--ok)' : 'var(--bad)', fontWeight: 800 }}>{r.growth >= 0 ? '▲' : '▼'} {Math.abs(Math.round(r.growth * 100))}%</span>}</div>
            <div className="s-kpi"><span>{sw ? 'Wateja' : 'Clients'}</span><b>{r.clients}</b><span>{sw ? 'wastani' : 'avg'} {short(r.avg)}</span></div>
            <div className="s-kpi"><span>{sw ? 'Faida halisi' : 'Net'}</span><b style={{ color: r.net < 0 ? 'var(--bad)' : undefined }}>{short(r.net)}</b><span>{sw ? 'baada ya gharama' : 'after costs'}</span></div>
            <div className="s-kpi"><span>{sw ? 'Wanaorudi' : 'Returning'}</span><b>{Math.round(r.returning * 100)}%</b></div>
            <div className="s-kpi"><span>{sw ? 'Hawakuja' : 'No-shows'}</span><b>{Math.round(r.noShow * 100)}%</b></div>
            <div className="s-kpi"><span>{sw ? 'Mtandaoni' : 'Online'}</span><b>{r.online}</b><span>{sw ? 'miadi' : 'bookings'}</span></div>
          </div>

          <div className="card" style={{ marginTop: 12, padding: 14 }}>
            <div className="s-row" style={{ justifyContent: 'space-between' }}>
              <b style={{ fontSize: 14 }}>{sw ? 'Mapato kwa siku' : 'Takings by day'}</b>
              <span style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{sw ? 'bila bakshishi' : 'excl. tips'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: days > 30 ? 1 : 3, height: 110, marginTop: 12 }}>
              {r.daily.map((d) => (
                <div key={d.date} title={`${d.date}: ${fmt(d.revenue)} · ${d.clients}`} style={{ flex: 1, height: `${Math.max(2, (d.revenue / maxDay) * 100)}%`, borderRadius: 3, background: d.revenue ? 'var(--brand)' : 'var(--card2)' }} />
              ))}
            </div>
          </div>

          <div className="desk" style={{ marginTop: 0 }}>
            <div className="desk-main">
              <div className="s-label">{sw ? 'Vinyozi' : 'Barbers'}</div>
              <div className="card" style={{ padding: '2px 14px' }}>
                {r.barbers.length === 0 ? <div style={{ padding: 14, color: 'var(--ink3)', fontSize: 13, fontWeight: 700 }}>—</div> : r.barbers.map((b, i) => (
                  <div key={b.name} className="s-row" style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
                    <span style={{ width: 22, fontWeight: 800, color: i === 0 ? 'var(--brand)' : 'var(--ink3)' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{b.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{b.clients} {sw ? 'wateja' : 'clients'} · {sw ? 'wastani' : 'avg'} {fmt(b.avgTicket)} · {sw ? 'kamisheni' : 'comm.'} {fmt(b.commission)}</div>
                    </div>
                    <b style={{ fontSize: 13.5 }}>{fmt(b.revenue)}</b>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-ghost tap" style={{ width: '100%', marginTop: 8, padding: 12 }} onClick={() => nav('/payouts')}>
                {sw ? 'Malipo ya vinyozi' : 'Barber payouts'}{r.owed > 0 ? ` · ${fmt(r.owed)} ${sw ? 'wanadai' : 'owed'}` : ''}
              </button>

              <div className="s-label">{sw ? 'Huduma' : 'Services'}</div>
              <div className="card" style={{ padding: '2px 14px' }}>
                {r.services.map((s, i) => {
                  const diff = s.listPrice ? (s.avgCharged - s.listPrice) / s.listPrice : 0;
                  return (
                    <div key={s.name} className="s-row" style={{ padding: '10px 0', borderTop: i ? '1px solid var(--line)' : undefined }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800 }}>{s.name} <span style={{ color: 'var(--ink3)', fontWeight: 700 }}>×{s.count}</span></div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: Math.abs(diff) >= 0.05 ? (diff > 0 ? 'var(--ok)' : 'var(--warn)') : 'var(--ink3)' }}>
                          {sw ? 'Wastani' : 'Avg charged'} {fmt(s.avgCharged)}{s.listPrice ? ` · ${sw ? 'orodha' : 'list'} ${fmt(s.listPrice)}` : ''}{Math.abs(diff) >= 0.05 ? ` (${diff > 0 ? '+' : ''}${Math.round(diff * 100)}%)` : ''}
                        </div>
                      </div>
                      <b style={{ fontSize: 13.5 }}>{fmt(s.revenue)}</b>
                    </div>
                  );
                })}
                {r.services.length === 0 && <div style={{ padding: 14, color: 'var(--ink3)', fontSize: 13, fontWeight: 700 }}>—</div>}
              </div>
            </div>

            <div className="desk-side">
              <div className="s-label">{sw ? 'Saa zenye shughuli' : 'Busy hours'}</div>
              <div className="card" style={{ padding: 12 }}>
                <div className="s-heat">
                  <span />
                  {HOURS.map((h) => <span key={h} style={{ textAlign: 'center' }}>{h % 2 === 0 ? h : ''}</span>)}
                  {(sw ? ['Jt', 'Jn', 'Jt', 'Al', 'Ij', 'Jm', 'Jp'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((d, wi) => (
                    <Fragment key={`d${wi}`}>
                      <span style={{ alignSelf: 'center' }}>{d}</span>
                      {HOURS.map((h) => {
                        const n = r.heat[wi][h];
                        return <div key={`${wi}-${h}`} title={`${n}`} style={{ background: n ? `color-mix(in srgb, var(--brand) ${Math.round(15 + (n / maxHeat) * 85)}%, transparent)` : 'var(--card2)' }} />;
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>

              <div className="s-label">{sw ? 'Fedha' : 'Money'}</div>
              <div className="card" style={{ padding: 14, fontSize: 13, display: 'grid', gap: 7 }}>
                {[
                  [sw ? 'Mapato (bila bakshishi)' : 'Takings (excl. tips)', r.revenue],
                  [sw ? 'Bakshishi' : 'Tips', r.tips],
                  [sw ? 'Kamisheni (bila bakshishi)' : 'Commission (excl. tips)', r.commission - r.tips ? -(r.commission - r.tips) : 0],
                  [sw ? 'Matumizi mengine' : 'Other expenses', r.otherExpenses ? -r.otherExpenses : 0],
                ].map(([k, v]) => (
                  <div key={String(k)} className="s-row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{k}</span>
                    <b>{fmt(Number(v))}</b>
                  </div>
                ))}
                {r.discounts > 0 && <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 700 }}>{sw ? 'Punguzo lililotolewa' : 'Discounts given'}: {fmt(r.discounts)} ({sw ? 'tayari limetolewa kwenye mapato' : 'already off the takings'})</div>}
                <div className="s-row" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 7 }}>
                  <b>{sw ? 'Faida halisi' : 'Net'}</b><b style={{ color: r.net < 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmt(r.net)}</b>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
