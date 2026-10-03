/*
  Bermi One — the 90-second ad. 1080×1920 logical, rendered at 4K (2160×3840).
  The toolkit below is shared with the phone film; the ad itself starts at
  "THE AD", cut to the voice timings in vo-timing.js.

  (From the phone film:) 1080×1920, about three minutes.

  renderAt(t) places every element for time t; EVENTS lists every sound cue,
  read by audio.py. The story is told chapter by chapter, each one a real
  feature of the app, on the app's own phone layout, with the same numbers the
  app would show:

    Kilimanjaro 500ml  opening 48 + 24 delivered = 72, counted 41 → sold 31
    Serengeti 500ml    opening 36            = 36, counted 29 → sold 7
    Konyagi 250ml      opening 12 + 6        = 18, counted 11 → sold 7
    Sales 108,500 + 24,500 + 42,000 = 175,000
    Cash 76,000 + mobile 77,000 + expense 12,000 + staff debt 10,000 = 175,000
*/
(function () {
  const W = 1080, H = 1920, CX = 540, CY = 960;
  const P = { x: 540, y: 1010 };

  // ------------------------------------------------------------------ helpers
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    lin: (p) => p,
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    out: (p) => 1 - Math.pow(1 - p, 3),
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    in: (p) => p * p * p,
    outBack: (p) => { const c1 = 1.3, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    sine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  };
  const seg = (t, a, b, e = E.inOut) => e(clamp((t - a) / (b - a)));
  const band = (t, a, b, fi = 0.35, fo = 0.35) => Math.min(seg(t, a, a + fi, E.out), 1 - seg(t, b - fo, b, E.inOut));
  const money = (v) => Math.round(v).toLocaleString('en-US');
  const tsh = (v) => 'TSh ' + money(v);
  const $ = (id) => document.getElementById(id);

  function el(parent, html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    const e = d.firstElementChild;
    parent.appendChild(e);
    return e;
  }
  function place(e, { x = CX, y = CY, s = 1, o = 1, r = 0, blur = 0, sy = 1 }) {
    e.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s},${s * sy}) rotate(${r}deg)`;
    e.style.opacity = o;
    e.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
    e.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
  }
  function show(e, o) { if (typeof e === 'string') e = $(e); e.style.opacity = o; e.style.visibility = o <= 0.002 ? 'hidden' : 'visible'; }
  function text(e, s) { if (typeof e === 'string') e = $(e); if (e && e.textContent !== s) e.textContent = s; }
  function html(e, s) { if (typeof e === 'string') e = $(e); if (e && e._h !== s) { e.innerHTML = s; e._h = s; } }
  function bez(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return { x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x, y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y };
  }
  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const R = rng(21);
  const rr = (a, b) => a + (b - a) * R();

  const IC = {
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><path d="M16 14.5h2"/>',
    chart: '<path d="M4 20V11"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M21 20H3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20c1.3-3.6 3.8-5.4 6.5-5.4s5.2 1.8 6.5 5.4"/><path d="M16 4.6a3.6 3.6 0 010 6.8"/><path d="M18 14.8c1.8.7 3 2.4 3.6 5.2"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    bell: '<path d="M6 16v-5a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
    refresh: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    building: '<rect x="4" y="3" width="10" height="18" rx="1.5"/><path d="M14 9h6v12h-6"/><path d="M7.5 7h3M7.5 11h3M7.5 15h3"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19"/><path d="M6 15h4"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    bottle: '<path d="M10 2h4v4l2 3v12a1 1 0 01-1 1H9a1 1 0 01-1-1V9l2-3z"/>',
    inbox: '<path d="M12 15V3"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    book: '<path d="M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-4a3 3 0 00-3 3"/><path d="M20 4v14h-6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
    del: '<path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
    signal: '<path d="M4 18v-2M9 18v-5M14 18v-8M19 18V6"/>',
  };
  const ic = (n, s = 18, sw = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;

  // ------------------------------------------------------------------ stage layers
  const stage = $('stage');
  const L = {};
  ['night', 'paper', 'bokeh', 'wall', 'devB', 'devA', 'fx', 'callouts', 'capband', 'caps', 'chap', 'brand', 'top'].forEach((k) => (L[k] = el(stage, `<div class="layer" id="L-${k}"></div>`)));
  L.night.classList.add('night');
  L.paper.classList.add('paper', 'grain');

  const BOKEH = [];
  for (let i = 0; i < 26; i++) {
    const sz = rr(60, 260);
    BOKEH.push({ e: el(L.bokeh, `<div class="abs bokeh" style="width:${sz}px;height:${sz}px"></div>`), x: rr(-40, 1120), y: rr(80, 1840), z: rr(0.4, 1.2), ph: rr(0, 6.28), hue: R() });
  }

  // ------------------------------------------------------------------ devices
  function makeDevice(parent, id) {
    const root = el(parent, `<div class="dev" id="${id}">
      <i class="btn" style="left:-4px;top:200px;height:44px"></i><i class="btn" style="left:-4px;top:270px;height:80px"></i><i class="btn" style="left:-4px;top:365px;height:80px"></i><i class="btn" style="right:-4px;left:auto;top:300px;height:120px"></i>
      <div class="screen"><div class="island"></div><div class="glass"></div></div></div>`);
    const screen = root.querySelector('.screen');
    const status = el(screen, `<div class="status"><span>23:04</span><span>${ic('signal', 17, 2.6)}<i>${ic('wallet', 17, 0)}</i><b style="display:inline-block;width:28px;height:13px;border-radius:4px;border:2px solid currentColor;margin-left:6px;position:relative;top:1px"><b style="position:absolute;left:1px;top:1px;bottom:1px;width:70%;background:currentColor;border-radius:2px"></b></b></span></div>`);
    const homebar = el(screen, `<div class="homebar"></div>`);
    const tap = el(screen, `<div class="tap"></div>`);
    return { id, root, screen, status, homebar, tap, screens: {}, state: null };
  }
  const A = makeDevice(L.devA, 'devA');
  const B = makeDevice(L.devB, 'devB');

  /** Device placement: screen point (fx,fy) lands on frame point (x,y). */
  function setDev(d, { x = CX, y = CY, s = 1, rx = 0, ry = 0, rz = 0, o = 1, fx = 215, fy = 382, full = 0 }) {
    // full = 1: the screen is the frame — square corners, no island, no glass
    d.screen.style.borderRadius = (58 * (1 - full)) + 'px';
    d.screen.querySelector('.island').style.opacity = 1 - full;
    d.screen.querySelector('.glass').style.opacity = 1 - full;
    const ox = fx + 16, oy = fy + 16;
    d.root.style.left = (x - ox) + 'px';
    d.root.style.top = (y - oy) + 'px';
    d.root.style.transformOrigin = `${ox}px ${oy}px`;
    d.root.style.transform = `perspective(2600px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
    show(d.root, o);
    d.state = { x, y, s, fx, fy };
  }
  /** Where a screen point appears in the frame (flat device). */
  function toFrame(d, sx, sy) { const st = d.state; return { x: st.x + (sx - st.fx) * st.s, y: st.y + (sy - st.fy) * st.s }; }

  const NAV_STAFF = (on) => `<div class="nav">${[['home', 'Home'], ['box', 'Stock'], ['check', 'Close Day'], ['receipt', 'My entries']].map(([i, l]) => `<div class="${l === on ? 'on' : ''}">${ic(i, 19)}<span>${l}</span></div>`).join('')}</div>`;
  const NAV_OWNER = (on, sw = false) => `<div class="nav">${[['home', 'Home', 'Nyumbani'], ['box', 'Stock', 'Bidhaa'], ['wallet', 'Money', 'Fedha'], ['chart', 'Reports', 'Ripoti'], ['grid', 'Manage', 'Simamia']].map(([i, l, s]) => `<div class="${l === on ? 'on' : ''}">${ic(i, 19)}<span>${sw ? `<span class="lx" data-en="${l}" data-sw="${s}">${l}</span>` : l}</span></div>`).join('')}</div>`;
  const TOPBAR = (name = 'Kilimanjaro Bar', role = 'Owner', id = '') => `<div class="tb"><div class="mk">${ic('bottle', 18)}</div><div style="flex:1;min-width:0"><b ${id ? `id="${id}"` : ''}>${name}</b><small>Your business. One system.</small></div><span class="chip">${ic(role === 'Owner' ? 'shield' : 'user', 12)} ${role}</span><div class="ib">${ic('moon', 16)}</div></div>`;
  const MARK = `<img src="mark.svg" style="width:30px;height:30px" alt="">`;

  function screenOf(d, key, markup, cls = '') {
    const e = el(d.screen, `<div class="scr ${cls}" id="${d.id}-${key}">${markup}</div>`);
    d.screens[key] = e;
    d.screen.appendChild(d.status); d.screen.appendChild(d.homebar); d.screen.appendChild(d.tap);
    d.screen.appendChild(d.screen.querySelector('.island')); d.screen.appendChild(d.screen.querySelector('.glass'));
    return e;
  }

  // ===== device A screens
  screenOf(A, 'lock', `<div class="lock"><div class="date">Tuesday 29 September</div><div class="clock">23:04</div>
    <div class="banner" id="banA" style="top:330px"><div class="app">${MARK}</div><div style="flex:1"><b>Bermi One</b><span>Tonight's count is due · Kilimanjaro Bar. Tap to start.</span></div><small>now</small></div></div>`);

  screenOf(A, 'gate', `<div class="body" style="padding-top:40px">
    <div style="display:flex;justify-content:center;margin-bottom:22px"><div style="width:70px;height:70px;border-radius:22px;background:#fff;box-shadow:var(--sh);display:grid;place-items:center"><img src="mark.svg" style="width:48px;height:48px"></div></div>
    <div class="lt" style="text-align:center;font-size:34px">Who's working?</div>
    <div class="lts" style="text-align:center">Kilimanjaro Bar · staff mode</div>
    ${[['J', 'Joseph Mtei', 'Bar attendant', 'g-joseph', 'linear-gradient(135deg,#0f8fd8,#2f5bff)'], ['A', 'Amina Said', 'Cashier', 'g-amina', 'linear-gradient(135deg,#0aa06e,#0f8fd8)'], ['H', 'Hamisi Juma', 'Store keeper', 'g-hamisi', 'linear-gradient(135deg,#c07a00,#e0304f)']].map(([a, n, r, id, g]) => `<div class="card row" id="${id}" style="padding:16px;margin-bottom:12px"><div style="width:52px;height:52px;border-radius:50%;background:${g};color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px">${a}</div><div style="flex:1"><b style="font-size:17px;display:block">${n}</b><small style="font-size:13px;color:var(--ink3);font-weight:600">${r}</small></div>${ic('right', 20)}</div>`).join('')}
    <div style="text-align:center;margin-top:18px;font-size:13px;font-weight:700;color:var(--ink3)">${ic('lock', 13)} Owner? Unlock with your owner PIN</div></div>`);

  screenOf(A, 'pin', `<div class="body" style="padding-top:70px;text-align:center">
    <div style="width:84px;height:84px;border-radius:50%;margin:0 auto 16px;background:linear-gradient(135deg,#0f8fd8,#2f5bff);color:#fff;display:grid;place-items:center;font-size:32px;font-weight:800">J</div>
    <div class="lt" style="font-size:30px">Hi Joseph</div><div class="lts">Enter your 4-digit PIN</div>
    <div class="dots" id="pin-dots"><i></i><i></i><i></i><i></i></div>
    <div class="pinpad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => `<span id="pk-${k || 'x'}" class="${k === '' ? 'g' : ''}">${k === 'del' ? ic('del', 24) : k}</span>`).join('')}</div></div>`);

  screenOf(A, 'shome', `<div class="body">${TOPBAR('Kilimanjaro Bar', 'Joseph')}
    <div class="lt">Good evening, Joseph</div><div class="lts">Signed in with your PIN · staff mode</div>
    <div class="hero"><div class="k">Tonight</div><div class="v" style="font-size:22px">Tuesday's count is open</div><div style="margin-top:14px;display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;background:rgba(255,255,255,.18);font-weight:800;font-size:14px">${ic('check', 15, 3)} Start counting</div></div>
    <div class="card row" style="padding:16px;margin-top:14px"><div class="ico" style="background:var(--okSoft);color:var(--ok)">${ic('inbox')}</div><div style="flex:1"><b style="font-size:14.5px;display:block">Add stock</b><small style="font-size:12px;color:var(--ink3);font-weight:600">Record a delivery</small></div>${ic('right')}</div>
    <div class="card row" style="padding:16px;margin-top:12px"><div class="ico" style="background:var(--vioSoft);color:var(--vio)">${ic('receipt')}</div><div style="flex:1"><b style="font-size:14.5px;display:block">My entries</b><small style="font-size:12px;color:var(--ink3);font-weight:600">Money you recorded today</small></div>${ic('right')}</div>
    <div class="card row" style="padding:14px 16px;margin-top:12px;background:var(--card2);box-shadow:none"><span style="color:var(--ink3)">${ic('lock', 16)}</span><small style="font-size:12.5px;font-weight:700;color:var(--ink2)">Profit and prices are hidden in staff mode</small></div>
  </div>${NAV_STAFF('Home')}`);

  const ITEM = (k, name, sub, q, unit = 'bottle') => `<div class="it" id="row-${k}"><div class="ico" style="background:var(--brandSoft);color:var(--brand)">${ic('bottle', 16)}</div><div style="flex:1"><b>${name}</b><small id="sub-${k}">${sub}</small></div><div class="qty"><b id="q-${k}">${q}</b><small style="display:block;color:var(--ink3);font-weight:600">${unit}</small></div></div>`;
  screenOf(A, 'stock', `<div class="body">${TOPBAR('Kilimanjaro Bar', 'Joseph')}
    <div class="lt">Stock</div><div class="lts">3 products · 2 categories</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="card" style="padding:14px" id="st-total-c"><div class="k">Total stock</div><div class="v" id="st-total">102</div></div>
      <div class="card" style="padding:14px" id="st-value-c"><div class="k">Stock value</div><div class="v" id="st-value">TSh 402,000</div></div></div>
    <div class="pbtn" id="btn-add" style="justify-content:flex-start;padding:0 18px">${ic('inbox', 18)}<span style="flex:1;text-align:left">Add stock<small style="display:block;font-size:11px;opacity:.8;font-weight:600">Goes into the closing being counted now</small></span>${ic('right', 16)}</div>
    <div class="card row" style="padding:12px 14px;margin-top:12px">${ic('search', 16)}<span style="color:var(--ink3);font-size:14px">Search product…</span></div>
    <div class="chips" style="margin-top:12px"><span class="on" id="ch-all">All</span><span id="ch-beer">Beer</span><span id="ch-spirits">Spirits</span></div>
    <div id="grp-beer"><div class="sec"><i style="background:var(--brand)"></i>Beer <span style="color:var(--ink3)">2</span></div>
    <div class="card" style="padding:4px 6px">${ITEM('k', 'Kilimanjaro 500ml', 'TSh 3,500', 48)}${ITEM('s', 'Serengeti 500ml', 'TSh 3,500', 36)}</div></div>
    <div id="grp-spirits"><div class="sec"><i style="background:var(--vio)"></i>Spirits <span style="color:var(--ink3)">1</span></div>
    <div class="card" style="padding:4px 6px">${ITEM('y', 'Konyagi 250ml', 'TSh 6,000 <span class="tag" id="tag-low" style="background:var(--warnSoft);color:var(--warn);margin-left:6px">Low</span>', 18)}</div></div>
  </div>${NAV_STAFF('Stock')}
  <div class="scrim" id="add-scrim"></div>
  <div class="sheet" id="sh-add"><div class="grab"></div><div class="sh-t">Add stock</div><div class="sh-s">A delivery goes into the closing being counted now.</div>
    <div class="sec">Product</div>
    <div class="chips"><span id="ap-k">Kilimanjaro 500ml</span><span>Serengeti</span><span>Konyagi</span></div>
    <div class="sec">Quantity received</div>
    <div class="row"><div class="inp" id="add-q" style="flex:1;height:54px;font-size:22px;justify-content:flex-start;padding-left:16px"></div><span style="font-weight:700;color:var(--ink3)">bottles</span></div>
    <div class="row" style="margin-top:12px;font-size:13px;color:var(--ink2);font-weight:600">${ic('doc', 15)} Delivery note #0471 · Serengeti Breweries</div>
    <div class="pbtn" id="btn-add-go" style="margin-top:18px">${ic('check', 18, 3)} Add to stock</div></div>`);

  const CROW = (k, name, sub) => `<div class="it" style="flex-wrap:wrap;border-bottom:1px solid var(--line)"><div class="ico" style="background:var(--brandSoft);color:var(--brand)">${ic('bottle', 16)}</div><div style="flex:1"><b>${name}</b><small>${sub}</small></div><div class="inp" id="in-${k}"></div><div class="sold" id="sold-${k}" style="width:100%;padding-top:8px"></div></div>`;
  const MROW = (k, icn, label) => `<div class="it"><div class="ico" style="background:var(--card2);color:var(--ink2);width:32px;height:32px">${ic(icn, 15)}</div><b style="flex:1">${label}</b><div class="inp" id="in-${k}" style="min-width:120px;justify-content:flex-end"></div></div>`;
  const DSEC = (k, label) => `<div class="sec" style="justify-content:space-between"><span>${label} <span id="tot-${k}" style="color:var(--ink3)"></span></span><span class="chip" id="add-${k}" style="background:#fff;border:1px solid var(--line);color:var(--ink)">${ic('plus', 12, 3)} Add</span></div><div class="card" style="padding:4px 8px" id="rows-${k}"></div>`;
  screenOf(A, 'close', `<div class="body" style="padding-top:0"><div id="close-scroll">
    <div class="row" style="padding:8px 0 4px"><div class="ib">${ic('left', 18)}</div><div style="flex:1"></div><span class="pill" id="c-pill" style="background:var(--warnSoft);color:var(--warn)">● Open</span></div>
    <div class="lt">Close a day</div><div class="lts">Tuesday 29 September · counting as <b style="color:var(--ink)">Joseph Mtei</b></div>
    <div class="card row" style="padding:14px 16px"><div style="flex:1"><div class="k">Counted</div><div class="v" id="c-cnt">0 / 3</div></div><div style="width:1px;align-self:stretch;background:var(--line)"></div><div style="flex:1;text-align:right"><div class="k" id="c-units">0 units sold</div><div class="v" id="c-exp">—</div></div></div>
    <div class="sec"><i style="background:var(--brand)"></i>Beer</div>
    <div class="card" style="padding:2px 6px">${CROW('k', 'Kilimanjaro 500ml', 'Opening 48 + 24 = 72 bottle')}${CROW('s', 'Serengeti 500ml', 'Opening 36 = 36 bottle')}</div>
    <div class="sec"><i style="background:var(--vio)"></i>Spirits</div>
    <div class="card" style="padding:2px 6px">${CROW('y', 'Konyagi 250ml', 'Opening 12 + 6 = 18 bottle')}</div>
    <div class="sec" style="margin-top:22px">Money collected</div>
    <div class="card" style="padding:2px 8px">${MROW('cash', 'wallet', 'Cash received')}${MROW('mob', 'phone', 'Mobile money')}${MROW('bank', 'building', 'Bank')}</div>
    ${DSEC('ex', 'Expense')}${DSEC('lo', 'Losses & damages')}${DSEC('de', 'Staff debt')}
    <div class="card row" style="padding:14px 16px;margin-top:16px"><span style="flex:1;font-size:13.5px;font-weight:700;color:var(--ink2)">Expected vs accounted</span><b id="c-match" style="font-size:14px">—</b></div>
    <div class="pbtn" id="btn-sub" style="margin-top:14px">Submit closing</div>
  </div></div>
  <div class="scrim" id="item-scrim"></div>
  <div class="sheet" id="sh-item"><div class="grab"></div><div class="sh-t" id="sh-item-t">Expense</div><div class="sh-s">Paid out of tonight's money</div>
    <div class="sec">Amount</div><div class="inp" id="sh-amt" style="height:54px;font-size:22px;justify-content:flex-start;padding-left:16px"></div>
    <div class="sec">What for</div><div class="inp" id="sh-note" style="height:50px;font-size:16px;font-weight:600;justify-content:flex-start;padding-left:16px"></div>
    <div class="pbtn" id="btn-item-go" style="margin-top:18px">Add</div></div>`);

  // number keyboard (shared by every typing moment on device A)
  const kbd = el(A.screen, `<div class="kbd" id="kbdA">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) => {
    const letters = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' }[k] || '';
    return `<span id="k-${k || 'x'}" class="${k === '' ? 'g' : k === 'del' ? 'g' : ''}">${k === 'del' ? ic('del', 24) : k}${letters ? `<small>${letters}</small>` : ''}</span>`;
  }).join('')}</div>`);
  A.screen.appendChild(A.homebar); A.screen.appendChild(A.tap);

  screenOf(A, 'roll', `<div class="body">${TOPBAR('Kilimanjaro Bar', 'Owner')}
    <div class="lt">Stock</div><div class="lts">Wednesday 30 September · opening</div>
    <div class="card" style="padding:16px;margin-bottom:12px;background:var(--okSoft);box-shadow:none"><div class="row"><span style="color:var(--ok)">${ic('refresh', 20)}</span><b style="font-size:14.5px;color:var(--ok);flex:1">Tuesday verified · counts carried forward</b></div></div>
    <div class="card" style="padding:6px 10px">
      <div class="row" style="padding:10px 4px;font-size:11.5px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px"><span style="flex:1">Product</span><span style="width:84px;text-align:center">Tue close</span><span style="width:24px"></span><span style="width:84px;text-align:center">Wed open</span></div>
      ${[['k', 'Kilimanjaro 500ml', 41, 72], ['s', 'Serengeti 500ml', 29, 36], ['y', 'Konyagi 250ml', 11, 18]].map(([k, n, c, o]) => `<div class="row" style="padding:14px 4px;border-top:1px solid var(--line)"><b style="flex:1;font-size:14.5px">${n}</b><span class="inp done" style="width:84px">${c}</span><span style="width:24px;color:var(--ink3);text-align:center">${ic('right', 16)}</span><span class="inp" id="ro-${k}" style="width:84px">${o}</span></div>`).join('')}
    </div>
    <div class="card row" style="padding:16px;margin-top:12px"><div class="ico" style="background:var(--warnSoft);color:var(--warn)">${ic('alert', 16)}</div><div style="flex:1"><b style="font-size:14px;display:block">Konyagi 250ml is low</b><small style="font-size:12px;color:var(--ink3);font-weight:600">11 left · usually 6 a night</small></div></div>
  </div>${NAV_OWNER('Stock')}`);

  screenOf(A, 'cash', `<div class="body">${TOPBAR('Kilimanjaro Bar', 'Owner')}
    <div class="lt">Cash book</div><div class="lts">Every shilling in and out</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      <div class="card" style="padding:12px"><div class="k">In</div><div class="v" id="cb-in" style="font-size:16px;color:var(--ok)">175,000</div></div>
      <div class="card" style="padding:12px"><div class="k">Out</div><div class="v" id="cb-out" style="font-size:16px">22,000</div></div>
      <div class="card" style="padding:12px" id="cb-bal-c"><div class="k">Balance</div><div class="v" id="cb-bal" style="font-size:16px">153,000</div></div></div>
    <div class="sec">Recent</div>
    <div class="card" style="padding:4px 8px;position:relative" id="cb-list">
      ${[['cb0', 'inbox', 'Sales · Tuesday closing', 'Joseph Mtei · 23:12', '+175,000', 'ok'], ['cb1', 'receipt', 'Ice & charcoal', 'Expense · Joseph Mtei', '−12,000', ''], ['cb2', 'user', 'Staff advance · Joseph', 'Staff debt', '−10,000', ''], ['cb3', 'card', 'Mobile money in', 'From closing · 77,000', 'matched', 'b']].map(([id, i, a, b, v, k]) => `<div class="it" id="${id}"><div class="ico" style="background:${k === 'ok' ? 'var(--okSoft)' : 'var(--card2)'};color:${k === 'ok' ? 'var(--ok)' : 'var(--ink2)'};width:34px;height:34px">${ic(i, 15)}</div><div style="flex:1"><b>${a}</b><small>${b}</small></div><b style="color:${k === 'ok' ? 'var(--ok)' : k === 'b' ? 'var(--brand)' : 'var(--ink)'}">${v}</b></div>`).join('')}
    </div>
    <div class="card row" style="padding:14px 16px;margin-top:12px"><span style="flex:1;font-size:13.5px;font-weight:700;color:var(--ink2)">Combined across businesses</span><span class="tgl"><i></i></span></div>
  </div>${NAV_OWNER('Money')}`);

  screenOf(A, 'reports', `<div class="body">${TOPBAR('Kilimanjaro Bar', 'Owner')}
    <div class="lt">Reports</div><div class="lts">Kilimanjaro Bar · last 7 days</div>
    <div class="seg"><div class="on" id="rp-bus">Whole business</div><div id="rp-prod">Per product</div></div>
    <div class="chips" style="margin:12px 0"><span>Today</span><span class="on">7 days</span><span>30 days</span><span>Custom</span></div>
    <div id="rp-a"><div class="hero" style="padding:18px"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;position:relative;z-index:1">
      <div><div class="k">Sales</div><div class="v" id="rp-sales" style="font-size:19px">1,152,000</div></div>
      <div><div class="k">Profit</div><div class="v" id="rp-profit" style="font-size:19px">298,400</div></div>
      <div><div class="k">Margin</div><div class="v" id="rp-margin" style="font-size:19px">25.9%</div></div></div></div>
    <div class="card" style="padding:16px;margin-top:12px"><div class="row" style="justify-content:space-between;margin-bottom:12px"><b style="font-size:14px">Sales by day</b><span class="k">TSh</span></div>
      <div class="bars">${[132, 118, 164, 238, 211, 114, 175].map((v, i) => `<div><i id="rb-${i}" class="${i === 6 ? 'now' : ''}" style="height:${v / 2.4}px"></i><span>${['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'][i]}</span></div>`).join('')}</div></div></div>
    <div id="rp-b" class="card" style="padding:4px 10px">${[['Kilimanjaro 500ml', 'TSh 118,800', 92], ['Konyagi 250ml', 'TSh 75,600', 64], ['Serengeti 500ml', 'TSh 41,650', 38], ['Safari Lager', 'TSh 36,200', 31], ['Soda 300ml', 'TSh 26,150', 22]].map(([n, p, w]) => `<div class="it" style="flex-wrap:wrap"><b style="flex:1">${n}</b><b style="color:var(--ok)">${p}</b><div style="width:100%;height:8px;border-radius:5px;background:var(--card2);margin-top:8px;overflow:hidden"><i style="display:block;height:100%;width:${w}%;background:var(--brand);border-radius:5px"></i></div></div>`).join('')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><div class="gbtn" id="rp-pdf">${ic('doc', 17)} PDF</div><div class="gbtn" id="rp-wa" style="color:#0a8d4a">${ic('chat', 17)} WhatsApp</div></div>
  </div>${NAV_OWNER('Reports')}`);

  screenOf(A, 'ai', `<div class="body" style="display:flex;flex-direction:column;padding-bottom:20px">
    <div class="row" style="padding:8px 0 12px"><div class="ib">${ic('left', 18)}</div><div style="flex:1;text-align:center"><b style="font-size:16px">Bermi AI</b><small style="display:block;font-size:11.5px;color:var(--ink3);font-weight:600">Knows your stock, money and staff</small></div><div class="ib" style="color:var(--brand)">${ic('spark', 18)}</div></div>
    <div class="card" style="padding:16px;margin-bottom:12px"><div class="row" style="gap:10px;margin-bottom:12px"><div class="ico" style="background:var(--brandSoft);color:var(--brand);width:34px;height:34px">${ic('spark', 16)}</div><b style="font-size:14.5px">Try asking</b></div>
      ${['How much did we sell today?', 'Who closed the day late this week?', 'What should I reorder tomorrow?', 'Compare Kilimanjaro Bar and Mbuyuni Lounge'].map((q) => `<div style="padding:11px 14px;border-radius:14px;background:var(--card2);font-size:13.5px;font-weight:600;color:var(--ink2);margin-top:8px">${q}</div>`).join('')}</div>
    <div id="ai-log" style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:12px;justify-content:flex-end;padding-bottom:12px">
      <div class="bub ai" style="font-size:13.5px;color:var(--ink2)">Good evening, Neema. Tuesday is verified. Ask me anything.</div>
      <div class="bub me" id="ai-q">Which drink made the most profit this week?</div>
      <div class="bub ai" id="ai-dots" style="padding:14px 18px"><span style="display:inline-flex;gap:6px">${[0, 1, 2].map((i) => `<i id="ai-d${i}" style="width:9px;height:9px;border-radius:50%;background:var(--ink3);display:inline-block"></i>`).join('')}</span></div>
      <div class="bub ai" id="ai-a"><span id="ai-a-t">Kilimanjaro 500ml — TSh 118,800 profit from 132 bottles. Konyagi is second at TSh 75,600, with the best margin per bottle.</span>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px" id="ai-tbl">${[['Kilimanjaro', 92], ['Konyagi', 64], ['Serengeti', 38]].map(([n, w]) => `<div class="row" style="gap:8px;font-size:12.5px;font-weight:700"><span style="width:84px">${n}</span><div style="flex:1;height:8px;border-radius:5px;background:var(--card2);overflow:hidden"><i style="display:block;height:100%;width:${w}%;background:var(--brand)"></i></div></div>`).join('')}</div></div>
      <div class="card" id="ai-ins" style="padding:14px;background:var(--brandSoft);box-shadow:none"><div class="row" style="align-items:flex-start"><div class="ico" style="background:#fff;color:var(--brand);width:34px;height:34px">${ic('spark', 16)}</div><div style="font-size:13.5px;font-weight:700;line-height:1.4"><span style="color:var(--brand)">Bermi noticed:</span> Konyagi runs out by Thursday. Reorder on Wednesday.</div></div></div>
    </div>
    <div class="card row" style="padding:10px 10px 10px 16px;border-radius:24px"><span id="ai-input" style="flex:1;font-size:14.5px;color:var(--ink3)">Ask anything…</span><div style="width:40px;height:40px;border-radius:50%;background:var(--grad);color:#fff;display:grid;place-items:center" id="ai-send">${ic('send', 17)}</div></div>
  </div>`);

  screenOf(A, 'ohome', `<div class="body">
    <div class="tb"><div class="mk">${ic('bottle', 18)}</div><div style="flex:1;min-width:0" id="oh-bizbtn"><b id="oh-biz">Kilimanjaro Bar</b><small>Tap to switch business ${ic('down', 11)}</small></div><span class="chip">${ic('shield', 12)} Owner</span><div class="ib">${ic('moon', 16)}</div></div>
    <div class="lt">Good evening, Neema</div><div class="lts" id="oh-sub">Tuesday 29 September</div>
    <div class="hero"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;position:relative;z-index:1"><div><div class="k">Sales today</div><div class="v" id="oh-sales">TSh 175,000</div></div><div><div class="k">Profit</div><div class="v" id="oh-profit">TSh 46,450</div></div></div></div>
    <div id="oh-combo"><div class="sec">Your businesses</div>
      ${[['Kilimanjaro Bar', 'Verified · cash matches', 'TSh 175,000', 'var(--brand)'], ['Mbuyuni Lounge', 'Submitted · waiting for you', 'TSh 137,000', 'var(--vio)']].map(([n, s, v, c]) => `<div class="card row" style="padding:14px 16px;margin-bottom:10px"><div class="ico" style="background:${c};color:#fff">${ic('building', 16)}</div><div style="flex:1"><b style="font-size:14.5px;display:block">${n}</b><small style="font-size:12px;color:var(--ink3);font-weight:600">${s}</small></div><b style="font-size:14px">${v}</b></div>`).join('')}</div>
    <div class="card row" id="oh-alert" style="padding:14px 16px;margin-top:12px"><div class="ico" style="background:var(--okSoft);color:var(--ok)">${ic('check', 16, 2.6)}</div><b style="flex:1;font-size:13.5px">Tuesday closed and verified</b></div>
    <div class="card" style="padding:16px;margin-top:12px"><div class="row" style="justify-content:space-between;margin-bottom:12px"><b style="font-size:14px">Last 7 days</b></div><div class="bars" style="height:90px">${[62, 48, 70, 96, 88, 40, 82].map((v, i) => `<div><i class="${i === 6 ? 'now' : ''}" style="height:${v}px"></i><span>${['W', 'T', 'F', 'S', 'S', 'M', 'T'][i]}</span></div>`).join('')}</div></div>
  </div>${NAV_OWNER('Home')}
  <div class="scrim" id="sw-scrim"></div>
  <div class="sheet" id="sw-sheet"><div class="grab"></div><div class="sh-t">Your businesses</div><div class="sh-s">One plan covers all of them</div>
    ${[['sw-k', 'Kilimanjaro Bar', 'Bar · Arusha', 'var(--brand)'], ['sw-m', 'Mbuyuni Lounge', 'Lounge · Moshi', 'var(--vio)'], ['sw-all', 'All businesses', 'Combined view', 'var(--ok)']].map(([id, n, s, c]) => `<div class="card row" id="${id}" style="padding:14px 16px;margin-top:10px"><div class="ico" style="background:${c};color:#fff">${ic(id === 'sw-all' ? 'grid' : 'building', 16)}</div><div style="flex:1"><b style="font-size:15px;display:block">${n}</b><small style="font-size:12px;color:var(--ink3);font-weight:600">${s}</small></div><span id="${id}-c" style="color:var(--brand)">${ic('check', 18, 3)}</span></div>`).join('')}
    <div class="gbtn" style="margin-top:14px">${ic('plus', 16)} Add a business</div></div>`);

  const LX = (en, sw) => `<span class="lx" data-en="${en}" data-sw="${sw}">${en}</span>`;
  const SET = (dark) => `<div class="body">${TOPBAR('Kilimanjaro Bar', 'Owner')}
    <div class="lt">${LX('Manage', 'Simamia')}</div><div class="lts">${LX('Settings for your whole business', 'Mipangilio ya biashara yako yote')}</div>
    <div class="sec">${LX('Settings', 'Mipangilio')}</div>
    <div class="card" style="padding:4px 8px">
      <div class="it" ${dark ? '' : 'id="set-lang"'}><div class="ico" style="background:var(--skySoft);color:var(--sky)">${ic('globe', 16)}</div><b style="flex:1">${LX('Language', 'Lugha')}</b><span class="pill" style="background:var(--card2);color:var(--ink)">${LX('English', 'Kiswahili')}</span></div>
      <div class="it"><div class="ico" style="background:var(--vioSoft);color:var(--vio)">${ic('moon', 16)}</div><b style="flex:1">${LX('Dark mode', 'Hali ya giza')}</b><span class="tgl ${dark ? 'on' : ''}" ${dark ? '' : 'id="set-dark"'}><i></i></span></div>
      <div class="it"><div class="ico" style="background:var(--okSoft);color:var(--ok)">${ic('users', 16)}</div><b style="flex:1">${LX('Staff', 'Wafanyakazi')}</b>${ic('right', 16)}</div>
      <div class="it"><div class="ico" style="background:var(--brandSoft);color:var(--brand)">${ic('building', 16)}</div><b style="flex:1">${LX('Business profile', 'Wasifu wa biashara')}</b>${ic('right', 16)}</div>
      <div class="it"><div class="ico" style="background:var(--warnSoft);color:var(--warn)">${ic('card', 16)}</div><b style="flex:1">${LX('Plan & billing', 'Kifurushi na malipo')}</b>${ic('right', 16)}</div></div>
    <div class="sec">${LX('Account', 'Akaunti')}</div>
    <div class="card" style="padding:4px 8px"><div class="it"><div class="ico" style="background:var(--card2);color:var(--ink2)">${ic('doc', 16)}</div><b style="flex:1">${LX('Export my data', 'Pakua taarifa zangu')}</b>${ic('right', 16)}</div>
      <div class="it"><div class="ico" style="background:var(--card2);color:var(--ink2)">${ic('lock', 16)}</div><b style="flex:1">${LX('Owner PIN', 'PIN ya mmiliki')}</b>${ic('right', 16)}</div></div>
  </div>${NAV_OWNER('Manage', true)}`;
  screenOf(A, 'set', SET(false));
  screenOf(A, 'setD', SET(true), 'dark');

  screenOf(A, 'price', `<div class="body">
    <div class="row" style="padding:8px 0 4px"><div class="ib">${ic('left', 18)}</div></div>
    <div class="lt">Plans and pricing</div><div class="lts">Pay monthly, quarterly or yearly.</div>
    <div class="seg" style="background:var(--card2)"><div id="pr-0">Monthly</div><div id="pr-1">Quarterly<small style="display:block;font-size:10px;color:var(--ok)">Save 10%</small></div><div id="pr-2">Annual<small style="display:block;font-size:10px;color:var(--ok)">2 months free</small></div></div>
    <div class="card" style="margin-top:14px;overflow:hidden;border:1.5px solid var(--brand)"><div style="padding:18px;background:var(--brandSoft)">
      <div class="row" style="justify-content:space-between;align-items:flex-start"><div><b style="font-size:19px">Standard</b> <span class="tag" style="background:var(--brand);color:#fff">Right for you</span><div style="font-size:12.5px;color:var(--ink2);margin-top:4px">Up to three businesses</div></div>
      <div style="text-align:right"><div style="font-size:22px;font-weight:800;letter-spacing:-.6px" id="pr-price">TSh 79,500</div><div style="font-size:11px;color:var(--ink3);font-weight:700" id="pr-per">$30 · per month</div><div id="pr-save" class="tag" style="background:var(--okSoft);color:var(--ok);margin-top:5px;display:inline-block"></div></div></div></div>
      <div style="padding:14px 18px">${['Up to 3 businesses', 'Up to 12 staff accounts', 'Combined reporting', 'Everything in Starter'].map((l) => `<div class="row" style="gap:9px;padding:4px 0;font-size:13px;color:var(--ink2)"><span style="color:var(--ok)">${ic('check', 14, 3)}</span>${l}</div>`).join('')}
      <div class="pbtn" id="pr-pay" style="margin-top:12px">${ic('phone', 17)} <span id="pr-pay-t">Pay TSh 79,500</span></div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">${[['Starter', '1 business', 'TSh 53,000'], ['Premium', 'Unlimited + SMS', 'TSh 119,250']].map(([n, d, v]) => `<div class="card" style="padding:14px"><b style="font-size:15px;display:block">${n}</b><small style="font-size:12px;color:var(--ink3);font-weight:600">${d}</small><div style="font-size:16px;font-weight:800;margin-top:8px">${v}</div><small style="font-size:11px;color:var(--ink3);font-weight:700">per month</small></div>`).join('')}</div>
    <div class="card row" id="pr-strip" style="padding:14px 16px;margin-top:12px;background:var(--okSoft);box-shadow:none"><span style="color:var(--ok)">${ic('check', 18, 3)}</span><b style="flex:1;font-size:13.5px;color:var(--ok)">Payment received · Standard is on until 29 Dec</b></div>
  </div>
  <div class="scrim" id="pay-scrim"></div>
  <div class="sheet" id="pay-sheet"><div class="grab"></div><div class="sh-t">Pay for Standard</div><div class="sh-s" id="pay-sub">TSh 214,650 ($81) · for 3 months</div>
    <div class="card row" style="padding:14px;margin-top:14px;background:var(--card2);box-shadow:none">${ic('alert', 15)}<span style="font-size:12.5px;color:var(--ink2)">A prompt arrives on this phone. Enter your mobile money PIN.</span></div>
    <div class="inp done" style="height:56px;font-size:20px;margin-top:12px;justify-content:flex-start;padding-left:16px">0754 123 456</div>
    <div class="pbtn" id="pay-go" style="margin-top:14px">Pay TSh 214,650</div></div>
  <div id="ussd" style="position:absolute;left:34px;right:34px;top:300px;background:#f2f2f4;border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.4);padding:22px 20px;z-index:29;text-align:center">
    <b style="font-size:16px;display:block">Mobile money</b><div style="font-size:14px;color:#333;margin-top:8px;line-height:1.45">Pay <b>TSh 214,650</b> to <b>BERMI ONE</b>.<br>Enter PIN to confirm.</div>
    <div class="dots" id="ussd-dots" style="margin:16px 0 6px"><i></i><i></i><i></i><i></i></div></div>`);

  // ===== device B (the owner's phone)
  screenOf(B, 'lock', `<div class="lock"><div class="date">Tuesday 29 September</div><div class="clock">23:12</div>
    <div class="banner" id="banB" style="top:330px"><div class="app">${MARK}</div><div style="flex:1"><b>Joseph submitted Tuesday</b><span>Sales TSh 175,000 · tap to review</span></div><small>now</small></div></div>`);
  screenOf(B, 'appr', `<div class="body">
    <div class="row" style="padding:8px 0 4px"><div class="ib">${ic('left', 18)}</div><div style="flex:1"></div><span class="pill" id="ap-pill" style="background:var(--brandSoft);color:var(--brand)">● Submitted</span></div>
    <div class="lt">Review Tuesday</div><div class="lts">Counted by Joseph Mtei · 23:11</div>
    <div class="card" style="padding:6px 14px">
      ${[['Expected sales', 'ap-exp', '175,000', ''], ['Cash', 'ap-cash', '76,000', ''], ['Mobile money', 'ap-mob', '77,000', ''], ['Expenses', 'ap-ex', '12,000', ''], ['Staff debt', 'ap-de', '10,000', '']].map(([a, id, v]) => `<div class="row" style="padding:13px 0;border-bottom:1px solid var(--line)"><span style="flex:1;font-size:14px;font-weight:600;color:var(--ink2)">${a}</span><b style="font-size:15px" id="${id}">${v}</b></div>`).join('')}
      <div class="row" style="padding:14px 0"><b style="flex:1;font-size:15px">Difference</b><span class="pill" id="ap-diff" style="background:var(--okSoft);color:var(--ok);font-size:13px">TSh 0 · balanced</span></div></div>
    <div class="card row" style="padding:14px 16px;margin-top:12px"><div class="ico" style="background:var(--badSoft);color:var(--bad);width:32px;height:32px">${ic('alert', 15)}</div><span style="flex:1;font-size:13.5px;font-weight:700">Recorded loss · broken bottle</span><b>3,500</b></div>
    <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px;margin-top:16px"><div class="gbtn">Send back</div><div class="pbtn" id="btn-ver">${ic('check', 18, 3)} <span id="btn-ver-t">Verify</span></div></div>
    <div class="toast" id="ver-toast" style="top:auto;bottom:40px;position:absolute"><div class="ico" style="background:var(--okSoft);color:var(--ok)">${ic('check', 18, 3)}</div><div><b>Tuesday verified</b><span>Counts locked · stock rolled over to Wednesday</span></div></div>
  </div>`);
  B.screen.appendChild(B.homebar); B.screen.appendChild(B.tap);

  // ------------------------------------------------------------------ frame-level graphics
  const capBand = el(L.capband, `<div class="layer" style="height:620px;background:linear-gradient(180deg,rgba(6,8,24,.96) 0%,rgba(6,8,24,.82) 50%,rgba(6,8,24,0) 100%)"></div>`);

  const chap = el(L.chap, `<div class="chap grain"><div class="glyph" id="ch-glyph"></div><div class="num" id="ch-num"></div><div class="line" id="ch-line"></div><div class="ttl" id="ch-ttl"></div><div class="sub" id="ch-sub"></div></div>`);

  const callout = (html_, cls = 'callout', style = '') => el(L.callouts, `<div class="abs ${cls}" style="${style}">${html_}</div>`);
  const dots = [];
  for (let i = 0; i < 18; i++) dots.push(el(L.fx, `<div class="abs dot sm"></div>`));

  // ------------------------------------------------------------------ captions
  const CAPS = [];
  function cap(t0, t1, htmlStr, y = 210, cls = '') {
    const e = el(L.caps, `<div class="cap ${cls}">${htmlStr.split(/(<br>)/).map((part) => part === '<br>' ? '<br>' : part.split(' ').filter(Boolean).map((w) => `<span class="w">${w}</span>`).join(' ')).join('')}</div>`);
    e.style.top = y + 'px';
    e.style.transform = 'translateY(-50%)';
    e._w = [...e.querySelectorAll('.w')];
    CAPS.push({ e, t0, t1 });
  }
  function drawCaps(t) {
    CAPS.forEach(({ e, t0, t1 }) => {
      if (t < t0 - 0.05 || t > t1 + 0.05) { e.style.visibility = 'hidden'; return; }
      const out = seg(t, t1 - 0.4, t1, E.inOut);
      e._w.forEach((w, i) => {
        const p = seg(t, t0 + i * 0.07, t0 + i * 0.07 + 0.6, E.outExpo);
        w.style.opacity = p * (1 - out);
        w.style.transform = `translateY(${(1 - p) * 30 - out * 14}px)`;
        w.style.filter = p < 0.98 ? `blur(${((1 - p) * 8).toFixed(1)}px)` : 'none';
      });
      e.style.visibility = 'visible';
    });
  }

  // ------------------------------------------------------------------ measuring
  const POS = {};
  function measure() {
    [A, B].forEach((d) => {
      d.root.style.transform = 'none'; d.root.style.left = '0px'; d.root.style.top = '0px';
      const base = d.screen.getBoundingClientRect();
      d.screen.querySelectorAll('[id]').forEach((n) => {
        const r = n.getBoundingClientRect();
        if (!r.width) return;
        const scroll = n.closest('#close-scroll') ? 'close' : null;
        POS[n.id] = { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2, w: r.width, h: r.height, scroll, dev: d.id };
      });
    });
  }
  const SCROLL = { close: 0 };
  /** Scroll needed to bring element `id` to screen y `y`. */
  const scrollTo = (id, y) => Math.max(0, (POS[id] ? POS[id].y : 0) - y);
  function sp(id) { const p = POS[id]; if (!p) return { x: 215, y: 466 }; return { x: p.x, y: p.y - (p.scroll ? SCROLL[p.scroll] : 0) }; }

  // ------------------------------------------------------------------ screen + overlay control
  function screens(d, map) {
    Object.entries(d.screens).forEach(([k, e]) => {
      const v = map[k];
      if (v === undefined) { show(e, 0); return; }
      const o = typeof v === 'number' ? v : v.o ?? 1;
      const x = typeof v === 'object' ? v.x || 0 : 0;
      e.style.transform = x ? `translateX(${x}px)` : '';
      show(e, o);
    });
  }
  function sheet(id, p, scrimId) {
    const e = $(id);
    e.style.transform = `translateY(${(1 - p) * 110}%)`;
    show(e, p > 0.001 ? 1 : 0);
    if (scrimId) show(scrimId, p);
  }
  function keyboard(p) { kbd.style.transform = `translateY(${(1 - p) * 330}px)`; show(kbd, p > 0.001 ? 1 : 0); }
  function statusLight(d, light) { d.status.classList.toggle('light', light); d.homebar.classList.toggle('light', light); }

  /** Typing: chars at `at` + i*gap; returns the visible string. */
  const typed = (u, at, str, gap = 0.26) => (u < at ? '' : str.slice(0, clamp(Math.floor((u - at) / gap) + 1, 0, str.length)));
  const typedDone = (at, str, gap = 0.26) => at + (str.length - 1) * gap;
  const withCommas = (s) => (s ? Number(s).toLocaleString('en-US') : '');
  function field(id, val, focus, u, placeholder = '') {
    const box = $(id);
    box.className = 'inp' + (focus ? ' on' : val ? ' done' : '');
    html(box, (val || (focus ? '' : placeholder)) + (focus && Math.floor(u * 2.4) % 2 === 0 ? '<span class="caret"></span>' : ''));
  }

  /** Fingertip: taps = [[u, targetId | {x,y}, device]] */
  function drawTaps(u, taps) {
    [A, B].forEach((d) => { d.tap.style.opacity = 0; });
    for (const [tt, target, dev = 'A'] of taps) {
      if (u < tt - 0.28 || u > tt + 0.42) continue;
      const d = dev === 'B' ? B : A;
      const p = typeof target === 'string' ? sp(target) : target;
      const pre = seg(u, tt - 0.28, tt, E.out), post = seg(u, tt, tt + 0.42, E.out);
      d.tap.style.opacity = u < tt ? pre * 0.9 : 0.9 * (1 - post);
      d.tap.style.transform = `translate(${p.x}px,${p.y}px) scale(${u < tt ? lerp(0.6, 0.85, pre) : lerp(0.85, 1.7, post)})`;
      if (target && typeof target === 'string') {
        const n = $(target);
        if (n && Math.abs(u - tt) < 0.12) n.style.filter = 'brightness(.9)'; else if (n) n.style.filter = '';
      }
    }
  }
  /** Taps for each char of a typed string, on the keyboard keys. */
  const keyTaps = (at, str, gap = 0.26) => [...str].map((c, i) => [at + i * gap, 'k-' + (c === ' ' ? 'x' : c)]);

  /** A stream of light from a to b. */
  function stream(u, a, b, t0, t1, n = 8, lift = 160) {
    for (let i = 0; i < n; i++) {
      const e = dots[i];
      const ph = (u - t0) * 0.9 - i / n;
      if (u < t0 || u > t1 + 1.2 || ph < 0 || ph > 1) { show(e, 0); continue; }
      const c1 = { x: a.x, y: a.y - lift }, c2 = { x: b.x, y: b.y - lift };
      const p = bez(a, c1, c2, b, E.inOut(ph));
      place(e, { x: p.x, y: p.y, s: 1, o: Math.sin(Math.PI * ph) });
    }
  }
  function hideDots() { dots.forEach((d) => show(d, 0)); }

  // ====================================================================== THE AD
  // Everything above this line is the phone film's toolkit: helpers, the app
  // screens, measuring, typing, taps. Below: a 90-second ad cut to the voice in
  // vo-timing.js, with the app filling the whole frame.

  const VO = window.VO || [];
  const V = (id) => (VO[id - 1] ? VO[id - 1].start : 0);
  const DUR = 90;

  // the screen exactly fills the frame: 430×764 logical → 1080×1920
  const FS = H / 764;
  /** Full-bleed camera, optionally punched in on (fx, fy); never shows past the screen's edge. */
  function full(k = 1, fx = 215, fy = 382) {
    const s = FS * k, hw = 540 / s, hh = 960 / s;
    return { x: CX, y: CY, s, fx: clamp(fx, hw, 430 - hw), fy: clamp(fy, hh, 764 - hh), full: 1 };
  }
  function glide(u, keys) {
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (u <= keys[i][0]) {
        const [ua, a] = keys[i - 1], [ub, b] = keys[i];
        const p = seg(u, ua, ub, E.inOut);
        const r = {};
        for (const k of Object.keys(b)) r[k] = lerp(a[k] ?? b[k], b[k], p);
        return r;
      }
    }
    return keys[keys.length - 1][1];
  }

  /** Whip between two screens on one device: a fast push with motion smear. */
  function whip(d, from, to, t, t0, dur = 0.32) {
    const p = seg(t, t0, t0 + dur, E.inOut);
    if (p <= 0) return screensBlur(d, { [from]: { o: 1 } });
    if (p >= 1) return screensBlur(d, { [to]: { o: 1 } });
    const b = Math.sin(Math.PI * p) * 9;
    screensBlur(d, { [from]: { o: 1, x: -430 * p, b }, [to]: { o: 1, x: 430 * (1 - p), b } });
  }
  function screensBlur(d, map) {
    Object.entries(d.screens).forEach(([k, e]) => {
      const v = map[k];
      if (!v) { show(e, 0); e.style.filter = ''; return; }
      e.style.transform = v.x ? `translateX(${v.x}px)` : '';
      e.style.filter = v.b ? `blur(${v.b.toFixed(1)}px)` : '';
      show(e, v.o ?? 1);
    });
  }

  function resetStock() {
    $('ch-all').className = 'on'; $('ch-spirits').className = ''; $('ch-beer').className = '';
    $('grp-beer').style.display = ''; $('row-k').style.background = ''; $('tag-low').style.transform = '';
  }
  // reused from the phone film: the closing screen's fields and the stock reset
  const AV = { k: [72, 3500], s: [36, 3500], y: [18, 6000] };
  function closeState(t, st) {
    $('close-scroll').style.transform = `translateY(${-SCROLL.close}px)`;
    let counted = 0, units = 0, sales = 0;
    ['k', 's', 'y'].forEach((key) => {
      const [at, str] = CNT[key];
      const done = st.counts > 1 || t >= typedDone(at, str, 0.22) + 0.1;
      const val = st.counts > 1 ? str : typed(t, at, str, 0.22);
      const focus = st.counts === 1 && t >= at - 0.35 && !(t >= typedDone(at, str, 0.22) + 0.45);
      field('in-' + key, val, focus, t, '—');
      if (done) {
        const sold = AV[key][0] - Number(str);
        counted++; units += sold; sales += sold * AV[key][1];
        html('sold-' + key, `<span>Sold <em>${sold}</em></span><span>Sales <em>${tsh(sold * AV[key][1])}</em></span>`);
        $('sold-' + key).style.display = 'flex';
      } else { html('sold-' + key, ''); $('sold-' + key).style.display = 'none'; }
    });
    text('c-cnt', `${counted} / 3`); text('c-units', `${units} units sold`); text('c-exp', sales ? tsh(sales) : '—');
    const m = st.money || {};
    field('in-cash', m.cash !== undefined ? withCommas(m.cash) : '', m.focus === 'cash', t, '0');
    field('in-mob', m.mob !== undefined ? withCommas(m.mob) : '', m.focus === 'mob', t, '0');
    field('in-bank', '', false, t, '0');
    const rows = st.rows || {};
    [['ex', 'Ice & charcoal', 12000], ['lo', 'Broken bottle', 3500], ['de', 'Joseph · advance', 10000]].forEach(([k, n, v]) => {
      const on = rows[k] || 0;
      html('rows-' + k, on > 0 ? `<div class="it" style="opacity:${on};transform:translateY(${(1 - on) * 10}px)"><div class="ico" style="background:var(--card2);color:var(--ink2);width:30px;height:30px">${ic(k === 'de' ? 'user' : k === 'lo' ? 'alert' : 'receipt', 14)}</div><b style="flex:1;font-size:14px">${n}</b><b>${money(v)}</b></div>` : `<div style="padding:12px;text-align:center;font-size:12.5px;color:var(--ink3)">Nothing added yet.</div>`);
      text('tot-' + k, on > 0 ? money(v) : '');
    });
    const all = rows.ex >= 1 && rows.de >= 1 && m.mob === 77000;
    const cm = $('c-match'); text(cm, all ? 'TSh 175,000 · balanced' : m.cash ? 'Counting…' : '—'); cm.style.color = all ? 'var(--ok)' : 'var(--ink)';
    const sub = st.submitted || 0;
    const b = $('btn-sub');
    b.style.background = sub ? 'var(--ok)' : ''; b.style.boxShadow = sub ? '0 14px 28px rgba(10,160,110,.3)' : '';
    html(b, sub ? `${ic('check', 18, 3)}&nbsp; Submitted for approval` : 'Submit closing');
    const pill = $('c-pill'); text(pill, sub ? '● Submitted' : '● Open'); pill.style.background = sub ? 'var(--brandSoft)' : 'var(--warnSoft)'; pill.style.color = sub ? 'var(--brand)' : 'var(--warn)';
  }

  // ---------------------------------------------------------------- graphics layer
  const G = (h, layer = L.callouts) => el(layer, h);
  L.paper.classList.remove('paper', 'grain');
  const flash = G(`<div class="flash"></div>`, L.paper);
  const bandB = el(L.capband, `<div class="layer" style="top:auto;bottom:0;height:760px;background:linear-gradient(0deg,rgba(6,8,24,.94) 0%,rgba(6,8,24,.78) 45%,rgba(6,8,24,0) 100%)"></div>`);
  const bandT = capBand; // top band, used when the keyboard owns the bottom of the screen
  L.chap.style.display = 'none';

  // the chaos (6–12 s)
  const nb = G(`<div class="abs panel nb">Kili 72 → <s>40</s> 41?<br>Seren. 36 … 29<br>Konyagi 18 – <s>12</s> 11<br>Cash 98,000 + ???<br>Joseph owes … ?<br><span style="color:#c0264a">Tues total ≠ ?</span></div>`, L.wall);
  const drawer = G(`<div class="abs panel drawer">${['#3b8a5a', '#7a4fb3', '#2f6fb3', '#3b8a5a', '#b3793b', '#7a4fb3'].map((c, i) => `<i class="note" style="background:${c};transform:rotate(${(i % 3 - 1) * 6}deg)"></i>`).join('')}${Array.from({ length: 7 }, () => '<i class="coin"></i>').join('')}</div>`, L.wall);
  const xl = G(`<div class="abs panel xl">${[['', 'Item', 'Open', 'Close', 'Sold'], ['1', 'Kili 500', '72', '41', '#REF!'], ['2', 'Serengeti', '36', '29', '7'], ['3', 'Konyagi', '18', '?', '#N/A'], ['4', 'Total', '', '', '=SUM(…']].map((r, i) => `<div class="r">${r.map((c, j) => `<div class="${i === 0 || j === 0 ? 'h' : ''} ${/#|=/.test(c) ? 'e' : ''}">${c}</div>`).join('')}</div>`).join('')}</div>`, L.wall);
  const q1 = G(`<div class="abs qbub"><small>Joseph · 23:41</small>Boss, crate count is short again 😕</div>`, L.wall);
  const q2 = G(`<div class="abs qbub"><small>You · 23:44</small>Which numbers do I trust?</div>`, L.wall);
  const words1 = ['Paper.', 'A drawer.', 'Trust?'].map((w) => G(`<div class="abs big grad">${w}</div>`));

  // overlays used by the demo
  const cSold = G(`<div class="abs callout" style="width:640px"><div class="k">Kilimanjaro 500ml</div><div class="big" style="font-size:96px">31 sold</div><div class="note">72 − 41 = 31 · TSh 108,500</div></div>`);
  const cExp = G(`<div class="abs callout" style="width:900px;background:linear-gradient(135deg,#2f5bff,#6b4bff);color:#fff;padding:40px 46px"><div class="row" style="gap:34px"><svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="9"/><circle id="ring-arc" cx="50" cy="50" r="42" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" transform="rotate(-90 50 50)" pathLength="1" stroke-dasharray="1 1"/><text x="50" y="57" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" font-family="Outfit" id="ring-t">3/3</text></svg><div><div class="k" style="color:rgba(255,255,255,.8);font-size:26px">Cash that should be in the drawer</div><div class="big" id="exp-v" style="font-size:100px;color:#fff">TSh 175,000</div></div></div></div>`);
  const cBal = G(`<div class="abs badge" style="font-size:44px;padding:28px 44px"><span style="color:var(--ok)">${ic('check', 44, 3)}</span> TSh 175,000 · balanced</div>`);
  const cLow = G(`<div class="abs badge" style="font-size:44px;padding:28px 44px"><span style="color:var(--warn)">${ic('alert', 44)}</span> Konyagi 250ml · 18 left</div>`);
  const stamp = G(`<div class="abs stamp"><div>${ic('check', 210, 2.6)}<b>VERIFIED</b></div></div>`);
  const cLang = G(`<div class="abs badge" style="font-size:44px;padding:28px 44px"><span style="color:var(--sky)">${ic('globe', 44)}</span> English · Kiswahili</div>`);
  const cPaid = G(`<div class="abs badge" style="font-size:44px;padding:28px 44px"><span style="color:var(--ok)">${ic('check', 44, 3)}</span> Paid · plan is on</div>`);
  const share = G(`<div class="abs share" style="width:900px;padding:40px 46px"><b style="font-size:40px" id="sh-t">Share weekly report</b><div style="font-size:26px;color:var(--ink2);margin-top:6px">weekly-report-kilimanjaro.pdf</div><div class="apps" style="gap:44px;margin-top:30px">${[['#25a35a', 'chat', 'WhatsApp'], ['#2f5bff', 'send', 'Email'], ['#94a0b8', 'doc', 'Files'], ['#c07a00', 'receipt', 'Print']].map(([c, i, n], k) => `<div ${k === 0 ? 'id="sh-wa"' : ''} style="font-size:24px"><i style="background:${c};width:130px;height:130px;border-radius:36px">${ic(i, 60)}</i>${n}</div>`).join('')}</div></div>`);
  const beats = ['Every bottle.', 'Every shilling.', 'Every night.'].map((w) => G(`<div class="abs big grad" style="font-size:168px">${w}</div>`));
  const cta = G(`<div class="abs cta">${ic('spark', 44)} Try it free · 14 days</div>`, L.brand);

  // ---------------------------------------------------------------- captions (lower third)
  const capY = 1660;
  [
    [0.9, 5.0, 'Every night, your business<br>tells a <em>story.</em>'],
    [V(4), V(4) + 2.7, 'Their own <em>PIN.</em>'],
    [V(5), V(5) + 2.7, 'Every bottle. <em>Live.</em>'],
    [V(5) + 2.9, V(6) - 0.3, 'Warned <em>before</em><br>it runs out.'],
    [V(6), V(7) - 0.2, 'Count the shelves.', 250],
    [V(7), V(7) + 5.6, 'Bermi does<br><em>the maths.</em>'],
    [V(8), V(9) - 0.1, 'Every <em>shilling.</em>', 250],
    [V(9), V(10) - 0.3, 'Accounted for.'],
    [V(10), V(11) - 0.2, 'Wherever <em>you are.</em>'],
    [V(12), V(13) - 0.4, 'Tomorrow,<br><em>already counted.</em>'],
    [V(13), V(14) - 0.2, 'The cash book<br><em>writes itself.</em>'],
    [V(14), V(15) - 0.3, 'Ready for <em>WhatsApp.</em>'],
    [V(15), V(16) - 0.4, 'Just <em>ask Bermi.</em>'],
    [V(16), V(17) - 0.2, 'One branch<br><em>or ten.</em>'],
    [V(17), V(18) - 0.4, 'Paid by<br><em>mobile money.</em>'],
    [V(20), V(20) + 3.0, 'Run your business<br><em>as one system.</em>'],
  ].forEach(([a, b, h, y]) => cap(a, b, h, y || capY));

  // ---------------------------------------------------------------- the demo's timings (cut to the voice)
  const T = {
    joseph: V(4) + 0.3, pin: [V(4) + 1.0, V(4) + 1.32, V(4) + 1.64, V(4) + 1.96], toStock: V(5) - 0.5,
    toClose: V(6) - 0.25,
  };
  const CNT = { k: [V(6) + 0.75, '41'], s: [V(6) + 1.55, '29'], y: [V(6) + 2.35, '11'] };
  const MONEY = { cash: V(8) + 0.25, mob: V(8) + 1.35 };

  // ---------------------------------------------------------------- finale wall
  const WALL = [];
  const wallScreens = [['A', 'stock'], ['A', 'cash'], ['A', 'reports'], ['B', 'appr'], ['A', 'ai'], ['A', 'roll'], ['A', 'set'], ['A', 'price']];
  const wallPos = [[-330, -560], [330, -560], [-400, 0], [400, 0], [-330, 560], [330, 560], [0, -800], [0, 820]];
  function buildWall() {
    wallScreens.forEach(([d, k], i) => {
      const src = (d === 'A' ? A : B).screens[k];
      const mini = el(L.wall, `<div class="abs" style="width:462px;height:796px;border-radius:74px;padding:16px;background:linear-gradient(145deg,#6d717c,#15171c 50%,#7b7f8a);box-shadow:0 40px 90px rgba(0,0,0,.5)"><div style="position:relative;width:430px;height:764px;border-radius:58px;overflow:hidden;background:var(--bg)"></div></div>`);
      const clone = src.cloneNode(true);
      clone.removeAttribute('id'); clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      clone.querySelectorAll('.sheet,.scrim,#ussd,.toast').forEach((n) => n.remove());
      clone.style.opacity = 1; clone.style.visibility = 'visible'; clone.style.transform = ''; clone.style.filter = '';
      mini.firstElementChild.appendChild(clone);
      WALL.push({ e: mini, p: wallPos[i], z: i % 2 ? 0.52 : 0.46 });
    });
  }

  const markTile = el(L.brand, `<div class="abs" style="width:250px;height:250px;border-radius:64px;background:#fff;display:grid;place-items:center;box-shadow:0 40px 110px rgba(47,91,255,.5)"><img src="mark.svg" style="width:200px;height:200px"></div>`);
  const word = el(L.brand, `<div class="abs wordmark" style="font-family:var(--display);font-weight:800;font-size:132px;letter-spacing:-4px">Bermi One</div>`);
  const tag1 = el(L.brand, `<div class="abs" style="font-size:44px;font-weight:600;color:#c9d2f0;white-space:nowrap">One system for every business.</div>`);
  const mainDot = el(L.top, `<div class="abs dot"></div>`);

  // ---------------------------------------------------------------- renderAt
  const OWNED = () => [...L.callouts.children, ...L.wall.children, flash, cta, markTile, word, tag1];
  function renderAt(t) {
    t = ((t % DUR) + DUR) % DUR;
    OWNED().forEach((e) => show(e, 0));
    hideDots();
    keyboard(0);
    show(bandB, 0); show(bandT, Math.max(band(t, V(6) - 0.1, V(7) - 0.1, 0.25, 0.3), band(t, V(8) - 0.1, V(9), 0.25, 0.3)));
    [A, B].forEach((d) => { d.tap.style.opacity = 0; statusLight(d, false); });
    setDev(A, { o: 0 }); setDev(B, { o: 0 });
    // every sheet, prompt and toast starts closed; scenes open what they use
    [['sh-add', 'add-scrim'], ['sh-item', 'item-scrim'], ['sw-sheet', 'sw-scrim'], ['pay-sheet', 'pay-scrim']].forEach(([id, sc]) => sheet(id, 0, sc));
    show('ussd', 0); show('pr-strip', 0); show('ver-toast', 0);
    const taps = [];

    // night: warm bokeh, strongest in the hook and the finale
    const bk = Math.max(band(t, 0.2, 6.6, 1.3, 0.6), band(t, 80.4, DUR, 1.0, 3.0) * 0.8, 0.12);
    BOKEH.forEach((b, i) => {
      const cyc = (2 * Math.PI * t) / DUR;
      place(b.e, { x: b.x + Math.sin(cyc * Math.max(1, Math.round(4 * b.z)) + b.ph) * 30, y: b.y + Math.cos(cyc * 3 + b.ph) * 20, s: b.z, o: bk * (0.25 + 0.55 * b.hue) * (i % 3 === 0 ? 1 : 0.7), blur: (1.3 - b.z) * 8 });
    });

    // ===== 0 – 6.2  hook: the phone wakes at night
    if (t < 6.4) {
      const rise = seg(t, 0.6, 2.6, E.out), out = seg(t, 5.7, 6.3, E.in);
      setDev(A, { x: CX, y: lerp(2300, 980, rise), s: lerp(1.45, 1.6, seg(t, 2.6, 5.7)) * (1 + out * 1.4), ry: lerp(-14, -4, rise), rx: lerp(8, 2, rise), o: (t > 0.6 ? 1 : 0) * (1 - out) });
      screensBlur(A, { lock: { o: 1 } });
      statusLight(A, true);
      const bp = seg(t, 2.2, 2.6, E.outBack);
      $('banA').style.transform = `translateY(${(1 - bp) * -60}px) scale(${lerp(0.9, 1, bp)})`; show('banA', clamp(bp * 1.4));
      show(bandB, band(t, 0.7, 5.2));
    }
    // the loop point
    {
      let dp = null;
      if (t < 1.3) dp = { x: P.x, y: P.y, s: 1 + seg(t, 0.2, 1.2) * 2, o: 1 - seg(t, 0.35, 1.2) };
      if (t >= 86.2) {
        const born = seg(t, 86.2, 86.9, E.out), go = seg(t, 86.9, DUR - 0.25, E.inOut);
        const c = bez({ x: CX, y: 1060 }, { x: CX + 120, y: 1100 }, { x: P.x - 80, y: P.y + 40 }, P, go);
        dp = { x: c.x, y: c.y, s: lerp(2.2, 1, born) * (1 + 0.2 * Math.sin(Math.PI * go)), o: born };
      }
      if (dp) place(mainDot, dp); else show(mainDot, 0);
    }

    // ===== 6.2 – 12.1  the way it is now
    if (t >= 6.0 && t < 12.4) {
      const shake = (k) => Math.sin(t * 47 + k) * 6 * band(t, 9.4, 11.0, 0.2, 0.2);
      const pin = (a, b, x0, y0, r, from) => {
        const p = seg(t, a, a + 0.35, E.outExpo), q = seg(t, 11.0, 11.7, E.in);
        return { x: lerp(from.x, x0, p) + shake(a), y: lerp(from.y, y0, p) + shake(a + 2), s: (1 - q * 0.95) * lerp(0.8, 1, p), r: r * (1 - q), o: Math.min(seg(t, a, a + 0.15), 1 - seg(t, 11.5, 11.75)) * (t < b ? 1 : 0) };
      };
      place(nb, pin(V(2) - 0.1, 12.2, 470, 760, -5, { x: -500, y: 900 }));
      place(drawer, pin(V(2) + 1.45, 12.2, 600, 1180, 4, { x: 1700, y: 1300 }));
      place(xl, pin(V(2) + 2.9, 12.2, 540, 520, -2, { x: 540, y: -500 }));
      place(q1, pin(V(2) + 3.3, 12.2, 470, 1480, 2, { x: -600, y: 1480 }));
      place(q2, pin(V(2) + 3.7, 12.2, 620, 1640, -1, { x: 1700, y: 1640 }));
      const wt = [V(2), V(2) + 1.5, V(2) + 3.0];
      words1.forEach((w, i) => {
        const p = seg(t, wt[i], wt[i] + 0.3, E.outBack);
        const end = i < 2 ? wt[i + 1] : 11.1;
        place(w, { x: CX, y: i === 2 ? 1040 : 1700, s: lerp(1.3, 1, p), o: Math.min(clamp(p * 1.5), 1 - seg(t, end - 0.12, end)) });
      });
      // everything collapses toward the centre
      const cx = [{ x: 470, y: 760 }, { x: 600, y: 1180 }, { x: 540, y: 520 }, { x: 470, y: 1480 }, { x: 620, y: 1640 }];
      cx.forEach((a, i) => stream1(i, t, a, { x: CX, y: CY }, 11.1 + i * 0.06));
    }

    // ===== 12.1 – 15.2  Meet Bermi One
    if (t >= 11.8 && t < 15.6) {
      const f = band(t, 11.95, 12.6, 0.12, 0.5);
      show(flash, f * 0.85);
      const m = seg(t, 12.15, 12.9, E.outBack), grow = seg(t, 13.6, 14.4, E.in);
      place(markTile, { x: CX, y: lerp(820, CY, grow), s: lerp(0.4, 1, m) * lerp(1, 4.2, grow), r: lerp(-12, 0, m), o: clamp(m * 1.4) * (1 - seg(t, 13.9, 14.3)) });
      const w = seg(t, V(3) + 0.25, V(3) + 0.9, E.outExpo);
      place(word, { x: CX, y: 1120 - (1 - w) * 30, o: w * (1 - seg(t, 13.8, 14.2)) });
      const app = seg(t, 14.2, 15.1, E.inOut);
      if (app > 0) {
        setDev(A, Object.assign(glide(app, [[0, { s: FS * 0.35, full: 0, y: CY }], [1, { s: FS, full: 1, y: CY }]]), { x: CX, fx: 215, fy: 382, o: seg(t, 14.2, 14.4) }));
        screensBlur(A, { gate: { o: 1 } });
      }
    }

    // ===== 15 – 25  PIN, then live stock
    if (t >= 15.0 && t < 25.4) {
      setDev(A, t < T.toStock + 0.3 ? full(1) : glide(t, [[T.toStock + 0.3, full(1)], [T.toStock + 1.0, full(1.3, 300, 230)], [V(5) + 2.4, full(1.3, 300, 230)], [V(5) + 3.0, full(1.2, 215, 560)], [24.8, full(1.2, 215, 560)], [25.3, full(1)]]));
      if (t < T.pin[0] - 0.4) screensBlur(A, { gate: { o: 1 } });
      else if (t < T.toStock) whip(A, 'gate', 'pin', t, T.pin[0] - 0.45, 0.3);
      else whip(A, 'pin', 'stock', t, T.toStock, 0.32);
      const n = T.pin.filter((x) => t >= x).length;
      [...$('pin-dots').children].forEach((d, i) => (d.className = i < n ? 'on' : ''));
      resetStock(); sheet('sh-add', 0, 'add-scrim');
      const v = seg(t, T.toStock + 0.4, T.toStock + 1.6, E.out);
      text('st-value', tsh(486000 * v)); text('st-total', String(Math.round(126 * v))); text('q-k', '72');
      $('tag-low').style.transform = `scale(${1 + 0.25 * Math.max(0, Math.sin((t - 21) * 6)) * band(t, V(5) + 3.0, 24.6)})`;
      taps.push([T.joseph, 'g-joseph', 'A'], [T.pin[0], 'pk-2', 'A'], [T.pin[1], 'pk-4', 'A'], [T.pin[2], 'pk-6', 'A'], [T.pin[3], 'pk-8', 'A']);
      const p = seg(t, V(5) + 3.2, V(5) + 3.6, E.outBack);
      place(cLow, { x: CX, y: 1240, s: lerp(0.7, 1, p), o: clamp(p * 1.4) * (1 - seg(t, 24.5, 24.9)) });
      show(bandB, 1);
    }

    // ===== 25 – 36  close the day: Bermi does the maths
    if (t >= 24.9 && t < 36.4) {
      SCROLL.close = 0;
      setDev(A, glide(t, [[25.0, full(1)], [25.5, full(1.1, 228, 330)], [V(7) - 0.1, full(1.1, 228, 330)], [V(7) + 0.5, full(1)]]));
      if (t < 25.4) whip(A, 'stock', 'close', t, T.toClose, 0.32); else screensBlur(A, { close: { o: 1 } });
      keyboard(seg(t, 25.35, 25.65, E.out) * (1 - seg(t, typedDone(...CNT.y, 0.22) + 0.4, typedDone(...CNT.y, 0.22) + 0.7)));
      closeState(t, { counts: 1 });
      ['k', 's', 'y'].forEach((k) => { taps.push([CNT[k][0] - 0.35, 'in-' + k, 'A']); [...CNT[k][1]].forEach((c, i) => taps.push([CNT[k][0] + i * 0.22, 'k-' + c, 'A'])); });
      const p1 = seg(t, V(7) + 0.7, V(7) + 1.1, E.outBack), p2 = seg(t, V(7) + 2.0, V(7) + 2.5, E.outBack), off = seg(t, 35.4, 35.9);
      place(cSold, { x: CX - 120, y: 560, s: lerp(0.6, 1, p1), r: -2, o: clamp(p1 * 1.4) * (1 - off) });
      place(cExp, { x: CX, y: 1050, s: lerp(0.6, 1, p2), o: clamp(p2 * 1.4) * (1 - off) });
      const k2 = seg(t, V(7) + 2.1, V(7) + 3.6, E.out);
      $('ring-arc').setAttribute('stroke-dashoffset', 1 - k2);
      text('exp-v', tsh(175000 * k2));
      show(bandB, 1);
    }

    // ===== 36 – 42.4  every shilling, accounted for
    if (t >= 36.0 && t < 42.8) {
      SCROLL.close = lerp(lerp(0, scrollTo('in-cash', 220), seg(t, 36.0, 36.35, E.inOut)), scrollTo('c-match', 470), seg(t, V(8) + 2.3, V(8) + 2.8, E.inOut));
      setDev(A, glide(t, [[36.0, full(1)], [36.35, full(1.1, 228, 330)], [V(8) + 2.3, full(1.1, 228, 330)], [V(8) + 2.8, full(1)]]));
      screensBlur(A, { close: { o: 1 } });
      keyboard(seg(t, MONEY.cash - 0.25, MONEY.cash) * (1 - seg(t, MONEY.mob + 0.75, MONEY.mob + 1.0)));
      const cash = typed(t, MONEY.cash, '76000', 0.14), mob = typed(t, MONEY.mob, '77000', 0.14);
      const rr0 = V(8) + 2.6;
      closeState(t, { counts: 2, money: { cash: cash ? Number(cash) : undefined, mob: mob ? Number(mob) : undefined, focus: t < MONEY.mob - 0.1 && t > MONEY.cash - 0.3 ? 'cash' : t >= MONEY.mob - 0.1 && t < MONEY.mob + 0.8 ? 'mob' : null }, rows: { ex: seg(t, rr0, rr0 + 0.25), lo: seg(t, rr0 + 0.3, rr0 + 0.55), de: seg(t, rr0 + 0.6, rr0 + 0.85) } });
      taps.push([MONEY.cash - 0.3, 'in-cash', 'A'], [MONEY.mob - 0.3, 'in-mob', 'A']);
      [...'76000'].forEach((c, i) => taps.push([MONEY.cash + i * 0.14, 'k-' + c, 'A']));
      [...'77000'].forEach((c, i) => taps.push([MONEY.mob + i * 0.14, 'k-' + c, 'A']));
      const p = seg(t, V(9), V(9) + 0.45, E.outBack);
      place(cBal, { x: CX, y: 1180, s: lerp(0.6, 1, p), o: clamp(p * 1.4) * (1 - seg(t, 42.1, 42.5)) });
      show(bandB, 1);
    }

    // ===== 42.4 – 52.3  on the owner's phone: verify; tomorrow is ready
    if (t >= 42.3 && t < 52.7) {
      const sub = 42.7;
      SCROLL.close = scrollTo('btn-sub', 560);
      const x = seg(t, 43.05, 43.4, E.inOut);
      setDev(A, Object.assign(full(1), { x: CX - 1080 * x, o: t < 43.45 ? 1 : 0 }));
      A.root.style.filter = x > 0 && x < 1 ? `blur(${(Math.sin(Math.PI * x) * 10).toFixed(1)}px)` : '';
      screensBlur(A, { close: { o: 1 } });
      closeState(t, { counts: 2, money: { cash: 76000, mob: 77000 }, rows: { ex: 1, lo: 1, de: 1 }, submitted: t >= sub + 0.06 ? 1 : 0 });
      taps.push([sub, 'btn-sub', 'A']);
      // Neema's phone
      const back = seg(t, 48.55, 48.9, E.inOut);
      if (t >= 43.05 && t < 48.95) {
        setDev(B, Object.assign(full(1), { x: CX + 1080 * (1 - x) - 1080 * back, rz: Math.sin(t * 60) * 0.8 * band(t, 43.6, 44.3, 0.05, 0.1) }));
        B.root.style.filter = (x > 0 && x < 1) || (back > 0 && back < 1) ? `blur(${(Math.sin(Math.PI * Math.max(x < 1 ? x : 0, back)) * 10).toFixed(1)}px)` : '';
        statusLight(B, t < 44.95);
        screensBlur(B, { lock: { o: 1 - seg(t, 44.9, 45.2) }, appr: { o: seg(t, 44.9, 45.2) } });
        const bp = seg(t, 43.6, 44.0, E.outBack);
        $('banB').style.transform = `translateY(${(1 - bp) * -60}px) scale(${lerp(0.9, 1, bp)})`; show('banB', clamp(bp * 1.4));
        const tick = seg(t, 45.25, 46.1, E.out);
        [['ap-exp', 175000], ['ap-cash', 76000], ['ap-mob', 77000], ['ap-ex', 12000], ['ap-de', 10000]].forEach(([id, v]) => text(id, money(v * tick)));
        show('ap-diff', seg(t, 46.0, 46.3));
        const ver = t >= V(11) + 0.1;
        $('btn-ver').style.background = ver ? 'var(--ok)' : ''; text('btn-ver-t', ver ? 'Verified' : 'Verify');
        const pill = $('ap-pill'); text(pill, ver ? '● Verified' : '● Submitted'); pill.style.background = ver ? 'var(--okSoft)' : 'var(--brandSoft)'; pill.style.color = ver ? 'var(--ok)' : 'var(--brand)';
        show('ver-toast', 0);
        taps.push([44.85, 'banB', 'B'], [V(11) + 0.05, 'btn-ver', 'B']);
      }
      const sp_ = seg(t, V(11) + 0.15, V(11) + 0.55, E.outBack);
      place(stamp, { x: CX, y: 900, s: lerp(1.8, 1, sp_), r: lerp(-30, -8, sp_), o: clamp(sp_ * 1.5) * (1 - seg(t, 48.3, 48.6)) });
      // tomorrow is ready
      if (t >= 48.55) {
        setDev(A, Object.assign(glide(t, [[48.9, full(1)], [49.4, full(1.2, 215, 330)], [52.0, full(1.2, 215, 330)]]), { x: CX + 1080 * (1 - back) }));
        A.root.style.filter = back > 0 && back < 1 ? `blur(${(Math.sin(Math.PI * back) * 10).toFixed(1)}px)` : '';
        screensBlur(A, { roll: { o: 1 } });
        [['k', 72, 41, V(12) + 0.1], ['s', 36, 29, V(12) + 0.45], ['y', 18, 11, V(12) + 0.8]].forEach(([k, from, to, at]) => {
          const p = seg(t, at, at + 0.4, E.inOut), e = $('ro-' + k);
          text(e, String(p < 0.5 ? from : to)); e.style.transform = `rotateX(${Math.sin(Math.PI * p) * 80}deg)`;
          e.className = 'inp' + (p >= 0.5 ? ' done' : ''); e.style.color = p >= 0.5 ? 'var(--brand)' : '';
        });
      }
      show(bandB, 1);
    } else { A.root.style.filter = ''; B.root.style.filter = ''; }

    // ===== 52.3 – 61.8  cash book, reports, ask Bermi
    if (t >= 52.2 && t < 62.2) {
      const w1 = 52.25, w2 = V(14) - 0.35, w3 = V(15) - 0.3;
      setDev(A, glide(t, [[52.3, full(1)], [53.3, full(1)], [53.8, full(1.15, 215, 280)], [w2 - 0.1, full(1.15, 215, 280)], [w2 + 0.2, full(1)], [62, full(1)]]));
      if (t < w2) whip(A, 'roll', 'cash', t, w1); else if (t < w3) whip(A, 'cash', 'reports', t, w2); else whip(A, 'reports', 'ai', t, w3);
      ['cb0', 'cb1', 'cb2', 'cb3'].forEach((id, i) => { const p = seg(t, 52.65 + i * 0.32, 52.95 + i * 0.32, E.outBack); const e = $(id); e.style.opacity = clamp(p * 1.3); e.style.transform = `translateY(${(1 - p) * -24}px)`; });
      const inP = seg(t, 52.7, 53.4, E.out), outP = seg(t, 53.0, 53.9, E.out);
      text('cb-in', money(175000 * inP)); text('cb-out', money(22000 * outP)); text('cb-bal', money(175000 * inP - 22000 * outP));
      $('rp-bus').className = 'on'; $('rp-prod').className = ''; $('rp-a').style.display = ''; $('rp-b').style.display = 'none';
      [132, 118, 164, 238, 211, 114, 175].forEach((v, i) => { $('rb-' + i).style.height = (v / 2.4) * seg(t, w2 + 0.3 + i * 0.07, w2 + 0.7 + i * 0.07, E.out) + 'px'; });
      const kk = seg(t, w2 + 0.3, w2 + 1.2, E.out);
      text('rp-sales', money(1152000 * kk)); text('rp-profit', money(298400 * kk)); text('rp-margin', (25.9 * kk).toFixed(1) + '%');
      taps.push([V(14) + 0.75, 'rp-wa', 'A']);
      const shp = seg(t, V(14) + 0.85, V(14) + 1.25, E.outExpo) * (1 - seg(t, w3 - 0.25, w3));
      place(share, { x: CX, y: lerp(2400, 1420, shp), o: shp > 0 ? 1 : 0 });
      $('sh-wa').style.transform = `scale(${1 - 0.1 * band(t, V(14) + 1.6, V(14) + 1.9, 0.1, 0.15)})`;
      text('sh-t', t >= V(14) + 1.75 ? 'Sent to Neema ✓' : 'Share weekly report');
      // ask Bermi
      const q0 = w3 + 0.35, Qs = 'Which drink made the most profit this week?';
      const n = clamp(Math.floor((t - q0) / 0.024), 0, Qs.length), sent = t >= q0 + 1.15;
      html('ai-input', sent ? 'Ask anything…' : n ? `<span style="color:var(--ink)">${Qs.slice(0, n)}</span><span class="caret"></span>` : 'Ask anything…');
      $('ai-q').style.display = sent ? '' : 'none';
      $('ai-dots').style.display = sent && t < q0 + 1.65 ? '' : 'none';
      [0, 1, 2].forEach((i) => { $('ai-d' + i).style.transform = `translateY(${-5 * Math.max(0, Math.sin((t * 7) - i * 0.9))}px)`; });
      const ans = t >= q0 + 1.65; $('ai-a').style.display = ans ? '' : 'none';
      const fullA = 'Kilimanjaro 500ml — TSh 118,800 profit from 132 bottles. Konyagi is second at TSh 75,600, with the best margin per bottle.';
      const ws = fullA.split(' ');
      text('ai-a-t', ws.slice(0, clamp(Math.floor((t - q0 - 1.65) / 0.04), 0, ws.length)).join(' '));
      $('ai-tbl').style.opacity = seg(t, q0 + 2.3, q0 + 2.6);
      $('ai-ins').style.display = t >= q0 + 2.7 ? '' : 'none'; $('ai-ins').style.opacity = seg(t, q0 + 2.7, q0 + 3.0);
      taps.push([q0 + 1.1, 'ai-send', 'A']);
      show(bandB, 1);
    }

    // ===== 61.8 – 70.8  every branch, your language, pay your way
    if (t >= 61.7 && t < 71.2) {
      const w1 = 61.75, w2 = V(16) + 1.9, w3 = V(17) - 0.35;
      setDev(A, full(1));
      if (t < w2) whip(A, 'ai', 'ohome', t, w1); else if (t < w3) whip(A, 'ohome', 'set', t, w2); else whip(A, 'set', 'price', t, w3);
      const sw0 = V(16) + 0.1;
      sheet('sw-sheet', seg(t, sw0 + 0.1, sw0 + 0.4, E.out) * (1 - seg(t, sw0 + 0.9, sw0 + 1.15)), 'sw-scrim');
      const all = t >= sw0 + 0.75;
      show('sw-k-c', all ? 0 : 1); show('sw-m-c', 0); show('sw-all-c', all ? 1 : 0);
      text('oh-biz', all ? 'All businesses' : 'Kilimanjaro Bar'); text('oh-sub', all ? 'Kilimanjaro Bar + Mbuyuni Lounge' : 'Tuesday 29 September');
      const kk = seg(t, sw0 + 1.1, sw0 + 1.8, E.out);
      text('oh-sales', tsh(lerp(175000, 312000, all ? kk : 0))); text('oh-profit', tsh(lerp(46450, 83100, all ? kk : 0)));
      $('oh-combo').style.display = all ? '' : 'none'; $('oh-alert').style.display = all ? 'none' : '';
      taps.push([sw0, 'oh-bizbtn', 'A'], [sw0 + 0.7, 'sw-all', 'A']);
      // language
      const lg = V(16) + 2.2;
      const swp = seg(t, lg + 0.1, lg + 0.45, E.inOut);
      A.screens.set.querySelectorAll('.lx').forEach((nn) => { text(nn, swp < 0.5 ? nn.dataset.en : nn.dataset.sw); nn.style.opacity = Math.abs(swp - 0.5) * 2; nn.style.display = 'inline-block'; });
      A.screens.setD.style.clipPath = 'circle(0px at 0 0)';
      taps.push([lg, 'set-lang', 'A']);
      const pl = seg(t, lg + 0.2, lg + 0.55, E.outBack);
      place(cLang, { x: CX, y: 1240, s: lerp(0.7, 1, pl), o: clamp(pl * 1.4) * (1 - seg(t, w3 - 0.2, w3)) });
      // pay
      const p0 = V(17) + 0.2;
      const per = t >= p0 + 1.2 ? 1 : t >= p0 + 0.6 ? 2 : t >= p0 ? 1 : 0;
      [0, 1, 2].forEach((i) => ($('pr-' + i).className = i === per ? 'on' : ''));
      const PR = [['TSh 79,500', '$30 · per month', '', 'Pay TSh 79,500'], ['TSh 214,650', '$81 · for 3 months', 'Save TSh 23,850', 'Pay TSh 214,650'], ['TSh 795,000', '$300 · per year', '2 months free', 'Pay TSh 795,000']][per];
      text('pr-price', PR[0]); text('pr-per', PR[1]); text('pr-save', PR[2]); show('pr-save', PR[2] ? 1 : 0); text('pr-pay-t', PR[3]);
      taps.push([p0 - 0.05, 'pr-1', 'A'], [p0 + 0.55, 'pr-2', 'A'], [p0 + 1.15, 'pr-1', 'A'], [p0 + 1.65, 'pr-pay', 'A'], [p0 + 2.3, 'pay-go', 'A']);
      sheet('pay-sheet', seg(t, p0 + 1.7, p0 + 2.0, E.out) * (1 - seg(t, p0 + 2.35, p0 + 2.6)), 'pay-scrim');
      const us = $('ussd'), up = seg(t, p0 + 2.5, p0 + 2.8, E.outBack) * (1 - seg(t, p0 + 3.6, p0 + 3.85));
      us.style.transform = `scale(${lerp(0.85, 1, up)})`; show(us, clamp(up * 1.3));
      const nd = [0, 0.18, 0.36, 0.54].filter((d) => t >= p0 + 2.85 + d).length;
      [...$('ussd-dots').children].forEach((d, i) => (d.className = i < nd ? 'on' : ''));
      const done = seg(t, p0 + 3.85, p0 + 4.2, E.outBack);
      const s = $('pr-strip'); s.style.transform = `scale(${lerp(0.9, 1, done)})`; show(s, clamp(done * 1.3));
      const pp = seg(t, p0 + 4.0, p0 + 4.4, E.outBack);
      place(cPaid, { x: CX, y: 1240, s: lerp(0.7, 1, pp), o: clamp(pp * 1.4) * (1 - seg(t, 70.8, 71.2)) });
      show(bandB, 1);
    }

    // ===== 70.8 – 90  Bermi One · every bottle, every shilling, every night · try it free
    if (t >= 70.6) {
      const u = t;
      const out = seg(u, 70.8, 72.2, E.inOut);
      const gather = seg(u, 80.6, 81.6, E.in);
      setDev(A, { x: CX, y: lerp(CY, 940, out), s: lerp(FS, 1.15, out) * (1 - gather * 0.7), fx: 215, fy: 382, full: 1 - out, ry: Math.sin(u * 0.7) * 6 * out * (1 - gather), o: 1 - seg(u, 81.0, 81.6) });
      screensBlur(A, { price: { o: 1 - seg(u, 70.8, 71.3) }, ohome: { o: seg(u, 70.8, 71.3) } });
      sheet('sw-sheet', 0, 'sw-scrim'); sheet('pay-sheet', 0, 'pay-scrim');
      text('oh-biz', 'Kilimanjaro Bar'); text('oh-sales', tsh(175000)); text('oh-profit', tsh(46450)); $('oh-combo').style.display = 'none'; $('oh-alert').style.display = '';
      // "Bermi One."
      const wm = seg(u, V(18) - 0.05, V(18) + 0.5, E.outExpo);
      place(word, { x: CX, y: 1640 - (1 - wm) * 30, o: wm * (1 - seg(u, V(19) - 0.3, V(19))) });
      // three beats
      const bt = [V(19), V(19) + 0.86, V(19) + 1.72];
      beats.forEach((b, i) => {
        const p = seg(u, bt[i], bt[i] + 0.25, E.outBack);
        const end = i < 2 ? bt[i + 1] : V(19) + 2.9;
        place(b, { x: CX, y: 1640, s: lerp(1.35, 1, p), o: Math.min(clamp(p * 1.6), 1 - seg(u, end - 0.08, end)) });
      });
      show(flash, Math.max(...bt.map((b) => band(u, b - 0.02, b + 0.45, 0.04, 0.4))) * 0.7);
      WALL.forEach((w, i) => {
        const ap = seg(u, V(19) - 0.4 + i * 0.08, V(19) + 0.6 + i * 0.08, E.outExpo);
        const drift = Math.sin(u * 0.6 + i) * 14;
        place(w.e, { x: lerp(CX, CX + w.p[0] * 1.05, ap * (1 - gather)) + drift, y: lerp(940, 940 + w.p[1], ap * (1 - gather)), s: lerp(0.2, w.z, ap) * (1 - gather * 0.6), r: (i % 2 ? 2 : -2) * (1 - gather), o: ap * (1 - seg(u, 81.0, 81.6)), blur: i >= 6 ? 1.5 : 0 });
      });
      show(bandB, band(u, 77.5, 81.2));
      // logo, try it free
      const m = seg(u, 81.6, 82.6, E.outExpo), fin = seg(u, 85.6, 86.5, E.inOut);
      if (u >= 81.4) {
        place(markTile, { x: CX, y: 720, s: lerp(0.85, 1, m) * (1 - fin * 0.1), o: m * (1 - fin) });
        const w2 = seg(u, 82.1, 82.9, E.outExpo);
        place(word, { x: CX, y: 1010 - (1 - w2) * 20, o: w2 * (1 - fin) });
        place(tag1, { x: CX, y: 1120, o: seg(u, 82.5, 83.1) * (1 - fin) });
        const c = seg(u, V(21) - 0.1, V(21) + 0.4, E.outBack);
        place(cta, { x: CX, y: 1330, s: lerp(0.7, 1, c) * (1 + 0.025 * Math.sin(Math.max(0, u - V(21)) * 5) * (1 - fin)), o: clamp(c * 1.4) * (1 - fin) });
      }
    }

    drawTaps2(t, taps);
    drawCaps(t);
  }

  /** Fingertip taps at absolute times; 'A'/'B' device, or keyboard key ('2' etc.) on A. */
  function drawTaps2(t, taps) {
    const list = taps.map((x) => (typeof x[0] === 'string' ? [x[1], 'k-' + x[0], 'A'] : x)).map(([tt, target, dev]) => [tt, target, dev]);
    [A, B].forEach((d) => (d.tap.style.opacity = 0));
    for (const [tt, target, dev] of list) {
      if (dev === 'X' || t < tt - 0.24 || t > tt + 0.36) continue;
      const d = dev === 'B' ? B : A;
      const p = typeof target === 'string' ? sp(target) : target;
      const pre = seg(t, tt - 0.24, tt, E.out), post = seg(t, tt, tt + 0.36, E.out);
      d.tap.style.opacity = t < tt ? pre * 0.9 : 0.9 * (1 - post);
      d.tap.style.transform = `translate(${p.x}px,${p.y}px) scale(${t < tt ? lerp(0.6, 0.85, pre) : lerp(0.85, 1.7, post)})`;
    }
  }

  /** One collapsing stream per chaos panel. */
  function stream1(i, t, a, b, t0) {
    for (let j = 0; j < 3; j++) {
      const e = dots[i * 3 + j];
      const ph = (t - t0) * 1.3 - j * 0.15;
      if (ph < 0 || ph > 1) { show(e, 0); continue; }
      const p = bez(a, { x: a.x, y: a.y - 200 }, { x: b.x, y: b.y + 200 }, b, E.inOut(ph));
      place(e, { x: p.x, y: p.y, o: Math.sin(Math.PI * ph) });
    }
  }

  // ---------------------------------------------------------------- sound cues
  const EVENTS = [];
  const ev = (t, type, gain = 1) => EVENTS.push({ t: +t.toFixed(3), type, gain });
  ev(0.3, 'bloom', 0.7); ev(0.6, 'rise', 0.5); ev(2.2, 'notify', 0.9); ev(2.2, 'haptic', 0.8); ev(5.7, 'reverse', 0.7);
  [V(2) - 0.1, V(2) + 1.45, V(2) + 2.9, V(2) + 3.3, V(2) + 3.7].forEach((x) => ev(x, 'slam', 0.8));
  ev(11.0, 'reverse', 0.9); ev(11.95, 'impact', 1); ev(12.15, 'logo', 0.9); ev(14.2, 'whoosh', 0.6);
  ev(T.joseph, 'tap', 0.8); ev(T.pin[0] - 0.45, 'swipe', 0.5); T.pin.forEach((x) => ev(x, 'key', 0.8)); ev(T.pin[3] + 0.15, 'success', 0.8);
  ev(T.toStock, 'swipe', 0.6); ev(T.toStock + 0.4, 'count', 0.6); ev(V(5) + 3.2, 'pop', 0.7);
  ev(T.toClose, 'swipe', 0.6);
  ['k', 's', 'y'].forEach((k) => { ev(CNT[k][0] - 0.35, 'tap', 0.7); [...CNT[k][1]].forEach((c, i) => ev(CNT[k][0] + i * 0.22, 'key', 0.7)); });
  ev(V(7) + 0.7, 'pop', 0.7); ev(V(7) + 2.0, 'whoosh', 0.5); ev(V(7) + 2.1, 'count', 0.7);
  [MONEY.cash, MONEY.mob].forEach((m0) => { ev(m0 - 0.3, 'tap', 0.7); for (let i = 0; i < 5; i++) ev(m0 + i * 0.14, 'key', 0.6); });
  [0, 0.3, 0.6].forEach((d) => ev(V(8) + 2.6 + d, 'pop', 0.5)); ev(V(9), 'success', 0.9);
  ev(42.7, 'tap', 0.8); ev(42.76, 'success', 0.7); ev(43.05, 'whoosh', 0.8); ev(43.6, 'notify', 1); ev(43.6, 'haptic', 1); ev(44.85, 'tap', 0.8); ev(45.25, 'count', 0.6);
  ev(V(11) + 0.05, 'tap', 0.9); ev(V(11) + 0.15, 'stampHit', 1); ev(V(11) + 0.2, 'confirm', 1);
  ev(48.55, 'whoosh', 0.7); [0.1, 0.45, 0.8].forEach((d) => ev(V(12) + d, 'flip', 0.7));
  ev(52.25, 'swipe', 0.6); [0, 1, 2, 3].forEach((i) => ev(52.65 + i * 0.32, 'pop', 0.45)); ev(52.7, 'count', 0.5);
  ev(V(14) - 0.35, 'swipe', 0.6); ev(V(14) + 0.75, 'tap', 0.8); ev(V(14) + 0.85, 'sheet', 0.7); ev(V(14) + 1.75, 'sent', 0.9);
  ev(V(15) - 0.3, 'swipe', 0.6); for (let i = 0; i < 40; i += 3) ev(V(15) + 0.05 + i * 0.024, 'type', 0.3); ev(V(15) + 0.85, 'sent', 0.7); ev(V(15) + 1.35, 'reply', 0.8); ev(V(15) + 2.4, 'notify', 0.5);
  ev(61.75, 'swipe', 0.6); ev(V(16) + 0.1, 'tap', 0.7); ev(V(16) + 0.2, 'sheet', 0.6); ev(V(16) + 0.8, 'tap', 0.7); ev(V(16) + 1.2, 'merge', 0.8);
  ev(V(16) + 1.9, 'swipe', 0.6); ev(V(16) + 2.2, 'tap', 0.7); ev(V(16) + 2.4, 'pop', 0.6);
  ev(V(17) - 0.35, 'swipe', 0.6); [0, 0.6, 1.2, 1.7, 2.35].forEach((d) => ev(V(17) + 0.15 + d, 'tap', 0.7)); ev(V(17) + 2.7, 'notify', 0.8); [0, 0.18, 0.36, 0.54].forEach((d) => ev(V(17) + 3.05 + d, 'key', 0.6)); ev(V(17) + 4.05, 'confirm', 1);
  ev(70.8, 'whoosh', 0.7); ev(V(18), 'logo', 0.7);
  [0, 0.86, 1.72].forEach((d) => ev(V(19) + d, 'slam', 0.4)); ev(V(19) - 0.4, 'rise', 0.6);
  ev(80.6, 'reverse', 0.8); ev(81.6, 'impact', 0.8); ev(81.7, 'logo', 1); ev(V(21) - 0.1, 'pop', 0.8); ev(86.2, 'bloom', 0.5);
  EVENTS.sort((a, b) => a.t - b.t);

  // ---------------------------------------------------------------- boot
  window.DUR = DUR;
  window.EVENTS = EVENTS;
  window.renderAt = renderAt;
  window.ready = document.fonts.ready.then(() => Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)))).then(() => {
    ['sh-add', 'sh-item', 'sw-sheet', 'pay-sheet'].forEach((id) => { $(id).style.transform = 'none'; });
    kbd.style.transform = 'none';
    $('ver-toast').style.display = 'flex';
    measure();
    buildWall();
    renderAt(0);
    return true;
  });
  if (/[?&]play/.test(location.search)) window.ready.then(() => { const t0 = performance.now(); const loop = () => { renderAt(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); });
  const mm = /[?&]t=([\d.]+)/.exec(location.search);
  if (mm) window.ready.then(() => renderAt(parseFloat(mm[1])));
})();
