/*
  Bermi One — the phone film. 1080×1920, about three minutes.

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
  function setDev(d, { x = CX, y = CY, s = 1, rx = 0, ry = 0, rz = 0, o = 1, fx = 215, fy = 466 }) {
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

  // ------------------------------------------------------------------ the chapters
  // Demo shot: phone large, captions over the top band.
  const DEMO = { x: CX, y: 1135, s: 1.62, fx: 215, fy: 466 };
  const cam = (o) => Object.assign({}, DEMO, o);
  /** Glide between camera states. */
  function camAt(u, keys) {
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (u <= keys[i][0]) {
        const [ua, a] = keys[i - 1], [ub, b] = keys[i];
        const p = seg(u, ua, ub, E.inOut);
        const r = {};
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) r[k] = lerp(a[k] ?? DEMO[k] ?? 0, b[k] ?? DEMO[k] ?? 0, p);
        return r;
      }
    }
    return keys[keys.length - 1][1];
  }

  const CH = [];
  const chapter = (o) => CH.push(o);

  // 01 — Who's working?
  chapter({
    num: '01', title: "Who's working?", sub: 'Every person signs in on the shared phone with their own PIN.', glyph: 'users', D: 10,
    caps: [[0.9, 5.4, 'Every person signs in<br>with <em>their own PIN.</em>'], [5.7, 10.2, 'Staff record. <em>Owners decide.</em>']],
    taps: [[2.4, 'g-joseph'], [3.7, 'pk-2'], [4.1, 'pk-4'], [4.5, 'pk-6'], [4.9, 'pk-8']],
    render(u) {
      setDev(A, camAt(u, [[0, cam({ s: 1.55 })], [5.2, cam({ s: 1.62 })], [6.0, cam({ s: 1.5, y: 1120 })], [10, cam({ s: 1.52, y: 1120 })]]));
      const toPin = seg(u, 2.75, 3.15, E.out), toHome = seg(u, 5.3, 5.7, E.out);
      screens(A, { gate: { o: 1 - toPin, x: -toPin * 120 }, pin: { o: toPin * (1 - toHome), x: (1 - toPin) * 120 }, shome: toHome });
      const n = [3.7, 4.1, 4.5, 4.9].filter((x) => u >= x).length;
      [...$('pin-dots').children].forEach((d, i) => (d.className = i < n ? 'on' : ''));
      const c1 = $('cl-profit'), c2 = $('cl-ownerpin');
      const p1 = seg(u, 6.2, 6.8, E.outBack), p2 = seg(u, 7.0, 7.6, E.outBack);
      place(c1, { x: CX, y: 1540, s: lerp(0.7, 1, p1), o: clamp(p1 * 1.5) * (1 - seg(u, 9.9, 10.3)) });
      place(c2, { x: CX, y: 1680, s: lerp(0.7, 1, p2), o: clamp(p2 * 1.5) * (1 - seg(u, 9.9, 10.3)) });
    },
    callouts: [`<div class="abs badge" id="cl-profit"><span style="color:var(--ink3)">${ic('lock', 34)}</span> Staff never see profit</div>`, `<div class="abs badge" id="cl-ownerpin"><span style="color:var(--brand)">${ic('shield', 34)}</span> Owner PIN locks owner mode</div>`],
  });

  // 02 — Stock at a glance
  chapter({
    num: '02', title: 'Stock at a glance', sub: 'Every bottle, every category — live, on the phone in your pocket.', glyph: 'box', D: 10,
    caps: [[0.9, 5.0, 'Every bottle.<br><em>Every category.</em>'], [5.3, 10.2, 'Low stock warns you<br><em>before</em> it runs out.']],
    taps: [[4.0, 'ch-spirits'], [7.3, 'ch-all']],
    render(u) {
      setDev(A, camAt(u, [[0, cam()], [2.6, cam()], [3.4, cam({ s: 2.15, fx: 215, fy: 560, y: 1060 })], [6.6, cam({ s: 2.15, fx: 215, fy: 560, y: 1060 })], [7.4, cam()]]));
      screens(A, { stock: 1 });
      resetStock();
      sheet('sh-add', 0, 'add-scrim');
      const v = seg(u, 0.9, 2.4, E.out);
      text('st-value', tsh(402000 * v)); text('st-total', String(Math.round(102 * v)));
      text('q-k', '48');
      const spirits = u >= 4.05 && u < 7.35;
      $('ch-all').className = spirits ? '' : 'on'; $('ch-spirits').className = spirits ? 'on' : ''; $('ch-beer').className = '';
      $('grp-beer').style.display = spirits ? 'none' : '';
      const low = $('tag-low'); low.style.transform = `scale(${1 + 0.18 * Math.max(0, Math.sin((u - 4.2) * 6)) * band(u, 4.2, 6.6)})`;
      const c = $('cl-value'), d2 = $('cl-low');
      const p1 = seg(u, 1.6, 2.4, E.outBack);
      place(c, { x: CX + 140, y: 1600, s: lerp(0.5, 1, p1), o: clamp(p1 * 1.4) * (1 - seg(u, 3.0, 3.4)) });
      text('cl-value-v', tsh(402000 * v));
      const p2 = seg(u, 7.6, 8.2, E.outBack);
      place(d2, { x: CX, y: 1610, s: lerp(0.7, 1, p2), o: clamp(p2 * 1.4) * (1 - seg(u, 9.9, 10.3)) });
    },
    callouts: [`<div class="abs callout" id="cl-value" style="width:560px"><div class="k">Stock value</div><div class="big" id="cl-value-v">TSh 402,000</div><div class="note">102 bottles on the shelf</div></div>`,
      `<div class="abs badge" id="cl-low"><span style="color:var(--warn)">${ic('alert', 34)}</span> Konyagi 250ml · 18 left</div>`],
  });

  function resetStock() {
    $('ch-all').className = 'on'; $('ch-spirits').className = ''; $('ch-beer').className = '';
    $('grp-beer').style.display = ''; $('row-k').style.background = ''; $('tag-low').style.transform = '';
  }

  // 03 — A delivery arrives
  chapter({
    num: '03', title: 'A delivery arrives', sub: 'Record it in seconds, right at the counter.', glyph: 'inbox', D: 9,
    caps: [[0.9, 4.6, 'A crate arrives?<br><em>Add it in seconds.</em>'], [4.9, 9.2, "It goes straight into<br><em>tonight's count.</em>"]],
    taps: [[1.1, 'btn-add'], [2.0, 'ap-k'], [2.55, 'add-q'], ...keyTaps(2.9, '24', 0.3), [4.2, 'btn-add-go']],
    render(u) {
      setDev(A, camAt(u, [[0, cam()], [1.6, cam()], [2.3, cam({ s: 1.95, fx: 215, fy: 700, y: 1180 })], [4.4, cam({ s: 1.95, fx: 215, fy: 700, y: 1180 })], [5.0, cam()]]));
      screens(A, { stock: 1 });
      resetStock();
      const sh = seg(u, 1.2, 1.6, E.out) * (1 - seg(u, 4.35, 4.7, E.inOut));
      sheet('sh-add', sh, 'add-scrim');
      keyboard(seg(u, 2.6, 2.9, E.out) * (1 - seg(u, 3.85, 4.1)));
      $('ap-k').className = u >= 2.05 ? 'on' : '';
      field('add-q', typed(u, 2.9, '24', 0.3), u >= 2.55 && u < 4.0, u, '0');
      const add = seg(u, 4.8, 5.6, E.out);
      text('q-k', String(Math.round(48 + 24 * add)));
      text('st-value', tsh(402000 + 84000 * add)); text('st-total', String(Math.round(102 + 24 * add)));
      $('row-k').style.background = band(u, 4.8, 7.4) > 0 ? `rgba(10,160,110,${0.12 * band(u, 4.8, 7.4)})` : '';
      // the crate lands in the row
      const crate = $('cl-crate');
      const drop = seg(u, 4.4, 5.2, E.outBack), sink = seg(u, 5.6, 6.2, E.in);
      const row = toFrame(A, sp('row-k').x, sp('row-k').y);
      place(crate, { x: lerp(CX, row.x, sink), y: lerp(lerp(-200, 1500, drop), row.y, sink), s: lerp(1, 0.2, sink), r: lerp(-8, 0, drop), o: u < 4.4 ? 0 : 1 - seg(u, 6.0, 6.25) });
      const t = $('cl-added');
      const p = seg(u, 6.3, 6.9, E.outBack);
      place(t, { x: CX, y: 1640, s: lerp(0.7, 1, p), o: clamp(p * 1.4) * (1 - seg(u, 8.9, 9.3)) });
    },
    callouts: [`<div class="abs callout" id="cl-crate" style="width:420px;padding:24px;background:linear-gradient(160deg,#8a5a2b,#5d3b1a);color:#fff"><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">${Array.from({ length: 24 }, () => '<i style="height:44px;border-radius:10px;background:linear-gradient(180deg,#2d6b3c,#163d22);box-shadow:inset 0 3px 0 rgba(255,255,255,.25)"></i>').join('')}</div><div style="margin-top:14px;font-family:var(--display);font-weight:800;font-size:34px">+24 Kilimanjaro 500ml</div></div>`,
      `<div class="abs badge" id="cl-added"><span style="color:var(--ok)">${ic('check', 34, 3)}</span> 48 + 24 = 72 on the shelf</div>`],
  });

  // 04 — Close the day
  const C4 = { k: [1.9, '41'], s: [3.4, '29'], y: [4.9, '11'] };
  chapter({
    num: '04', title: 'Close the day', sub: 'Count the shelves. Bermi does the maths.', glyph: 'check', D: 15,
    caps: [[0.9, 5.8, "Count what's<br>on the shelf."], [6.1, 10.0, 'Bermi does <em>the maths.</em>'], [10.3, 15.2, 'Sold, sales and cash —<br><em>expected instantly.</em>']],
    taps: [[1.5, 'in-k'], ...keyTaps(1.9, '41', 0.3), [3.0, 'in-s'], ...keyTaps(3.4, '29', 0.3), [4.5, 'in-y'], ...keyTaps(4.9, '11', 0.3)],
    render(u) {
      SCROLL.close = lerp(0, scrollTo('in-cash', 360), seg(u, 10.2, 13.2, E.inOut));
      setDev(A, camAt(u, [[0, cam()], [1.0, cam()], [1.6, cam({ s: 1.9, fx: 215, fy: 380, y: 1060 })], [5.8, cam({ s: 1.9, fx: 215, fy: 470, y: 1060 })], [6.6, cam({ s: 1.55 })], [15, cam({ s: 1.6 })]]));
      screens(A, { close: 1 });
      sheet('sh-item', 0, 'item-scrim');
      keyboard(seg(u, 1.55, 1.85, E.out) * (1 - seg(u, 5.7, 6.0)));
      closeState(u, { counts: 1 });
      // callouts
      const k = $('cl-sold'), tot = $('cl-total');
      const p1 = seg(u, 6.6, 7.2, E.outBack), p2 = seg(u, 7.6, 8.2, E.outBack);
      place(k, { x: CX - 150, y: 1520, s: lerp(0.6, 1, p1), r: -2, o: clamp(p1 * 1.4) * (1 - seg(u, 9.8, 10.2)) });
      place(tot, { x: CX + 120, y: 1700, s: lerp(0.6, 1, p2), r: 1.5, o: clamp(p2 * 1.4) * (1 - seg(u, 9.8, 10.2)) });
      text('cl-total-v', tsh(175000 * seg(u, 7.6, 8.8, E.out)));
    },
    callouts: [`<div class="abs callout" id="cl-sold" style="width:520px"><div class="k">Kilimanjaro 500ml</div><div class="big">31 sold</div><div class="note">72 − 41 = 31 · TSh 108,500</div></div>`,
      `<div class="abs callout" id="cl-total" style="width:540px;background:var(--grad);color:#fff"><div class="k" style="color:rgba(255,255,255,.8)">Expected tonight · 3 / 3 counted</div><div class="big" id="cl-total-v">TSh 175,000</div></div>`],
  });

  /** The closing screen's fields, for a given story position. */
  function closeState(u, st) {
    $('close-scroll').style.transform = `translateY(${-SCROLL.close}px)`;
    const AV = { k: [72, 3500], s: [36, 3500], y: [18, 6000] };
    let counted = 0, units = 0, sales = 0;
    ['k', 's', 'y'].forEach((key) => {
      const [at, str] = C4[key];
      const done = st.counts > 1 || u >= typedDone(at, str, 0.3) + 0.1;
      const val = st.counts > 1 ? str : typed(u, at, str, 0.3);
      const focus = st.counts === 1 && u >= at - 0.4 && !(u >= typedDone(at, str, 0.3) + 0.6);
      field('in-' + key, val, focus, u, '—');
      if (done) {
        const sold = AV[key][0] - Number(str);
        counted++; units += sold; sales += sold * AV[key][1];
        html('sold-' + key, `<span>Sold <em>${sold}</em></span><span>Sales <em>${tsh(sold * AV[key][1])}</em></span>`);
        $('sold-' + key).style.display = 'flex';
      } else { html('sold-' + key, ''); $('sold-' + key).style.display = 'none'; }
    });
    text('c-cnt', `${counted} / 3`); text('c-units', `${units} units sold`); text('c-exp', sales ? tsh(sales) : '—');
    const m = st.money || {};
    field('in-cash', m.cash !== undefined ? withCommas(m.cash) : '', m.focus === 'cash', u, '0');
    field('in-mob', m.mob !== undefined ? withCommas(m.mob) : '', m.focus === 'mob', u, '0');
    field('in-bank', '', false, u, '0');
    const rows = st.rows || {};
    [['ex', 'Ice & charcoal', 12000], ['lo', 'Broken bottle', 3500], ['de', 'Joseph · advance', 10000]].forEach(([k, n, v]) => {
      const on = rows[k] || 0;
      html('rows-' + k, on > 0 ? `<div class="it" style="opacity:${on};transform:translateY(${(1 - on) * 10}px)"><div class="ico" style="background:var(--card2);color:var(--ink2);width:30px;height:30px">${ic(k === 'de' ? 'user' : k === 'lo' ? 'alert' : 'receipt', 14)}</div><b style="flex:1;font-size:14px">${n}</b><b>${money(v)}</b></div>` : `<div style="padding:12px;text-align:center;font-size:12.5px;color:var(--ink3)">Nothing added yet.</div>`);
      text('tot-' + k, on > 0 ? money(v) : '');
    });
    const all = st.rows && rows.ex >= 1 && rows.de >= 1 && m.mob === 77000;
    const cm = $('c-match'); text(cm, all ? 'TSh 175,000 · balanced' : m.cash ? 'Counting…' : '—'); cm.style.color = all ? 'var(--ok)' : 'var(--ink)';
    const sub = st.submitted || 0;
    const b = $('btn-sub');
    b.style.background = sub ? 'var(--ok)' : ''; b.style.boxShadow = sub ? '0 14px 28px rgba(10,160,110,.3)' : '';
    html(b, sub ? `${ic('check', 18, 3)}&nbsp; Submitted for approval` : 'Submit closing');
    const pill = $('c-pill'); text(pill, sub ? '● Submitted' : '● Open'); pill.style.background = sub ? 'var(--brandSoft)' : 'var(--warnSoft)'; pill.style.color = sub ? 'var(--brand)' : 'var(--warn)';
  }

  // 05 — Every shilling
  chapter({
    num: '05', title: 'Every shilling', sub: 'Cash, mobile money, bank — and every expense, loss and staff debt.', glyph: 'wallet', D: 11,
    caps: [[0.9, 4.4, 'Cash. Mobile money. <em>Bank.</em>'], [4.7, 11.2, 'Expenses, losses<br>and <em>staff debts</em> — in the count.']],
    taps: [[0.9, 'in-cash'], ...keyTaps(1.2, '76000', 0.2), [2.5, 'in-mob'], ...keyTaps(2.8, '77000', 0.2), [5.0, 'add-ex'], ...keyTaps(5.6, '12000', 0.2), [6.9, 'btn-item-go'], [7.7, 'add-lo'], [8.4, 'add-de']],
    render(u) {
      SCROLL.close = lerp(scrollTo('in-cash', 360), scrollTo('add-ex', 250), seg(u, 4.0, 4.8, E.inOut));
      setDev(A, camAt(u, [[0, cam({ s: 1.6 })], [0.6, cam({ s: 1.85, fx: 215, fy: 470, y: 1080 })], [4.0, cam({ s: 1.85, fx: 215, fy: 470, y: 1080 })], [4.8, cam({ s: 1.6 })]]));
      screens(A, { close: 1 });
      keyboard(Math.max(seg(u, 0.95, 1.2, E.out) * (1 - seg(u, 3.7, 4.0)), seg(u, 5.3, 5.55, E.out) * (1 - seg(u, 6.6, 6.85))));
      const cash = typed(u, 1.2, '76000', 0.2), mob = typed(u, 2.8, '77000', 0.2);
      const shp = seg(u, 5.05, 5.4, E.out) * (1 - seg(u, 7.0, 7.3));
      sheet('sh-item', shp, 'item-scrim');
      field('sh-amt', withCommas(typed(u, 5.6, '12000', 0.2)), u < 6.6 && u > 5.2, u, '0');
      html('sh-note', u > 6.5 ? 'Ice & charcoal' : '<span style="color:var(--ink3)">e.g. ice, charcoal</span>');
      closeState(u, { counts: 2, money: { cash: cash ? Number(cash) : undefined, mob: mob ? Number(mob) : undefined, focus: u >= 0.9 && u < 2.5 ? 'cash' : u >= 2.5 && u < 3.9 ? 'mob' : null }, rows: { ex: seg(u, 7.15, 7.5), lo: seg(u, 7.85, 8.2), de: seg(u, 8.55, 8.9) } });
      ['cl-ex', 'cl-lo', 'cl-de'].forEach((id, i) => {
        const p = seg(u, 9.0 + i * 0.3, 9.6 + i * 0.3, E.outBack);
        place($(id), { x: CX + (i - 1) * 40, y: 1460 + i * 130, s: lerp(0.6, 1, p), r: (i - 1) * 2, o: clamp(p * 1.4) * (1 - seg(u, 10.9, 11.3)) });
      });
    },
    callouts: [[`Expense · ice & charcoal`, '−12,000', 'receipt', 'var(--ink)'], ['Loss · broken bottle', '−3,500', 'alert', 'var(--bad)'], ['Staff debt · Joseph', '−10,000', 'user', 'var(--warn)']].map(([a, b, i, c], k) => `<div class="abs badge" id="${['cl-ex', 'cl-lo', 'cl-de'][k]}" style="width:820px;justify-content:space-between"><span style="display:flex;align-items:center;gap:12px"><span style="color:${c}">${ic(i, 34)}</span>${a}</span><span>${b}</span></div>`),
  });

  // 06 — Submit. Verify.
  chapter({
    num: '06', title: 'Submit. Verify.', sub: 'Joseph submits. Neema checks it from anywhere — and verifies with one tap.', glyph: 'shield', D: 12,
    caps: [[0.9, 2.6, 'Joseph submits.'], [2.9, 6.4, 'Neema sees it<br><em>wherever she is.</em>'], [6.7, 12.2, 'One tap.<br><em>Verified.</em>']],
    taps: [[1.0, 'btn-sub'], [4.5, 'banB', 'B'], [8.3, 'btn-ver', 'B']],
    render(u) {
      SCROLL.close = scrollTo('btn-sub', 720);
      const split = seg(u, 1.6, 2.8, E.inOut), lead = seg(u, 4.7, 5.9, E.inOut);
      setDev(A, { x: lerp(CX, 300, split) - lead * 500, y: lerp(1135, 1180, split), s: lerp(1.6, 0.92, split), ry: 12 * split, o: 1 - seg(u, 5.2, 5.8) });
      setDev(B, { x: lerp(lerp(1500, 790, split), CX, lead), y: lerp(1180, 1135, lead), s: lerp(0.92, 1.62, lead), ry: lerp(-12 * split, 0, lead), rz: Math.sin(u * 60) * 1.2 * band(u, 3.4, 4.1, 0.05, 0.1), o: seg(u, 1.6, 2.2) });
      screens(A, { close: 1 });
      keyboard(0);
      closeState(u, { counts: 2, money: { cash: 76000, mob: 77000 }, rows: { ex: 1, lo: 1, de: 1 }, submitted: u >= 1.08 ? 1 : 0 });
      statusLight(B, u < 4.7);
      screens(B, { lock: 1 - seg(u, 4.6, 4.9), appr: seg(u, 4.6, 4.9) });
      const bp = seg(u, 3.4, 3.8, E.outBack);
      $('banB').style.transform = `translateY(${(1 - bp) * -60}px) scale(${lerp(0.9, 1, bp)})`; show('banB', clamp(bp * 1.4));
      const tick = seg(u, 5.4, 6.6, E.out);
      [['ap-exp', 175000], ['ap-cash', 76000], ['ap-mob', 77000], ['ap-ex', 12000], ['ap-de', 10000]].forEach(([id, v]) => text(id, money(v * tick)));
      show('ap-diff', seg(u, 6.4, 6.8));
      const ver = u >= 8.35;
      const vb = $('btn-ver'); vb.style.background = ver ? 'var(--ok)' : ''; text('btn-ver-t', ver ? 'Verified' : 'Verify');
      const pill = $('ap-pill'); text(pill, ver ? '● Verified' : '● Submitted'); pill.style.background = ver ? 'var(--okSoft)' : 'var(--brandSoft)'; pill.style.color = ver ? 'var(--ok)' : 'var(--brand)';
      const tp = seg(u, 8.5, 9.0, E.outExpo) * (1 - seg(u, 11.6, 12.0));
      const vt = $('ver-toast'); vt.style.transform = `translateY(${(1 - tp) * 40}px)`; show(vt, tp);
      // the closing travels from Joseph's phone to Neema's
      const a = toFrame(A, 215, 700), b = toFrame(B, 215, 380);
      stream(u, a, b, 2.4, 3.4, 10, 220);
      const bd = $('cl-bal');
      const p = seg(u, 6.8, 7.4, E.outBack);
      place(bd, { x: CX, y: 1690, s: lerp(0.7, 1, p), o: clamp(p * 1.4) * (1 - seg(u, 8.0, 8.3)) });
    },
    callouts: [`<div class="abs badge" id="cl-bal"><span style="color:var(--ok)">${ic('check', 34, 3)}</span> Difference TSh 0 · balanced</div>`],
  });

  // 07 — Tomorrow is ready
  chapter({
    num: '07', title: 'Tomorrow is ready', sub: "Tonight's count becomes tomorrow's opening. Nothing to copy.", glyph: 'refresh', D: 7,
    caps: [[0.9, 7.2, 'Tomorrow starts<br><em>already counted.</em>']],
    taps: [],
    render(u) {
      setDev(A, camAt(u, [[0, cam()], [1.0, cam({ s: 1.9, fx: 215, fy: 420, y: 1100 })], [5.6, cam({ s: 1.9, fx: 215, fy: 420, y: 1100 })], [6.6, cam()]]));
      screens(A, { roll: 1 });
      [['k', 72, 41, 1.4], ['s', 36, 29, 2.0], ['y', 18, 11, 2.6]].forEach(([k, from, to, at]) => {
        const p = seg(u, at, at + 0.5, E.inOut);
        const e = $('ro-' + k);
        text(e, String(p < 0.5 ? from : to));
        e.style.transform = `rotateX(${Math.sin(Math.PI * p) * 80}deg)`;
        e.className = 'inp' + (p >= 0.5 ? ' done' : '');
        e.style.color = p >= 0.5 ? 'var(--brand)' : '';
      });
      const c = $('cl-roll'); const p = seg(u, 3.6, 4.2, E.outBack);
      place(c, { x: CX, y: 1640, s: lerp(0.7, 1, p), o: clamp(p * 1.4) * (1 - seg(u, 6.8, 7.2)) });
    },
    callouts: [`<div class="abs badge" id="cl-roll"><span style="color:var(--brand)">${ic('refresh', 34)}</span> Tonight's count = tomorrow's opening</div>`],
  });

  // 08 — Cash book
  chapter({
    num: '08', title: 'The cash book', sub: 'Money in and money out — written for you from every closing.', glyph: 'book', D: 10,
    caps: [[0.9, 5.2, 'The cash book<br><em>writes itself.</em>'], [5.5, 10.2, 'Money in. Money out.<br><em>Always balanced.</em>']],
    taps: [],
    render(u) {
      setDev(A, camAt(u, [[0, cam()], [4.2, cam()], [5.0, cam({ s: 2.0, fx: 215, fy: 470, y: 1120 })], [8.0, cam({ s: 2.0, fx: 215, fy: 470, y: 1120 })], [8.8, cam()]]));
      screens(A, { cash: 1 });
      ['cb0', 'cb1', 'cb2', 'cb3'].forEach((id, i) => {
        const p = seg(u, 1.0 + i * 0.6, 1.5 + i * 0.6, E.outBack);
        const e = $(id); e.style.opacity = clamp(p * 1.3); e.style.transform = `translateY(${(1 - p) * -24}px)`;
      });
      const inP = seg(u, 1.0, 1.8, E.out), outP = seg(u, 1.6, 2.8, E.out);
      text('cb-in', money(175000 * inP)); text('cb-out', money(22000 * outP)); text('cb-bal', money(175000 * inP - 22000 * outP));
      const c = $('cl-cb'); const p = seg(u, 5.6, 6.2, E.outBack);
      place(c, { x: CX, y: 1600, s: lerp(0.6, 1, p), o: clamp(p * 1.4) * (1 - seg(u, 9.8, 10.2)) });
      text('cl-cb-v', tsh(153000 * seg(u, 5.6, 6.8, E.out)));
    },
    callouts: [`<div class="abs callout" id="cl-cb" style="width:600px"><div class="k">Balance today</div><div class="big" id="cl-cb-v">TSh 153,000</div><div class="note">+175,000 in · −22,000 out</div></div>`],
  });

  // 09 — Reports
  chapter({
    num: '09', title: 'Reports', sub: 'Charts, per-product profit, PDF and WhatsApp — in two taps.', glyph: 'chart', D: 12,
    caps: [[0.9, 5.6, 'Your week,<br><em>at a glance.</em>'], [5.9, 12.2, 'Send it as a PDF —<br>or <em>straight to WhatsApp.</em>']],
    taps: [[3.5, 'rp-prod'], [5.7, 'rp-pdf'], [8.6, 'rp-wa']],
    render(u) {
      setDev(A, camAt(u, [[0, cam()], [5.6, cam()], [6.2, cam({ s: 1.3, x: CX, y: 1250 })], [12, cam({ s: 1.3, x: CX, y: 1250 })]]));
      screens(A, { reports: 1 });
      const perProd = u >= 3.6;
      $('rp-bus').className = perProd ? '' : 'on'; $('rp-prod').className = perProd ? 'on' : '';
      $('rp-a').style.display = perProd ? 'none' : ''; $('rp-b').style.display = perProd ? '' : 'none';
      [132, 118, 164, 238, 211, 114, 175].forEach((v, i) => { $('rb-' + i).style.height = (v / 2.4) * seg(u, 0.9 + i * 0.12, 1.5 + i * 0.12, E.out) + 'px'; });
      const k = seg(u, 0.9, 2.2, E.out);
      text('rp-sales', money(1152000 * k)); text('rp-profit', money(298400 * k)); text('rp-margin', (25.9 * k).toFixed(1) + '%');
      // a PDF unfolds out of the phone, then the share sheet rises
      const pdf = $('cl-pdf');
      const pp = seg(u, 5.9, 6.7, E.outBack);
      place(pdf, { x: CX - 120, y: lerp(1300, 760, pp), s: lerp(0.3, 1, pp), sy: lerp(0.2, 1, seg(u, 5.9, 6.6, E.out)), r: -3 * pp, o: clamp(pp * 2) * (1 - seg(u, 11.6, 12.0)) });
      const sh = $('cl-share');
      const sp_ = seg(u, 8.8, 9.4, E.outExpo);
      place(sh, { x: CX, y: lerp(2300, 1500, sp_), o: sp_ > 0 ? 1 - seg(u, 11.6, 12.0) : 0 });
      const wa = $('wa-app'); wa.style.transform = `scale(${1 - 0.1 * band(u, 10.5, 10.8, 0.1, 0.15)})`;
      text('wa-sent', u >= 10.7 ? 'Sent to Neema ✓' : 'Share report');
    },
    callouts: [`<div class="abs pdf" id="cl-pdf"><div class="row" style="justify-content:space-between"><h3>Weekly report</h3><img src="mark.svg" style="width:44px"></div><div style="font-size:17px;color:var(--ink2);margin:4px 0 16px">Kilimanjaro Bar · 23–29 September</div>${[['Sales', 'TSh 1,152,000'], ['Profit', 'TSh 298,400'], ['Best seller', 'Kilimanjaro 500ml'], ['Cash vs expected', 'Balanced every night']].map(([a, b]) => `<div class="r"><span>${a}</span><b>${b}</b></div>`).join('')}<div class="bars" style="height:110px;margin-top:18px">${[132, 118, 164, 238, 211, 114, 175].map((v, i) => `<div><i class="${i === 6 ? 'now' : ''}" style="height:${v / 2.4}px"></i></div>`).join('')}</div></div>`,
      `<div class="abs share" id="cl-share"><b style="font-size:24px" id="wa-sent">Share report</b><div style="font-size:17px;color:var(--ink2);margin-top:4px">weekly-report-kilimanjaro.pdf</div><div class="apps"><div id="wa-app"><i style="background:#25a35a">${ic('chat', 40)}</i>WhatsApp</div><div><i style="background:#2f5bff">${ic('send', 38)}</i>Email</div><div><i style="background:#94a0b8">${ic('doc', 38)}</i>Files</div><div><i style="background:#c07a00">${ic('receipt', 38)}</i>Print</div></div></div>`],
  });

  // 10 — Ask Bermi
  const Q = 'Which drink made the most profit this week?';
  chapter({
    num: '10', title: 'Ask Bermi', sub: 'Questions about your business, answered from your own numbers.', glyph: 'spark', D: 10,
    caps: [[0.9, 5.4, 'Ask anything about<br><em>your business.</em>'], [5.7, 10.2, 'Bermi answers from<br><em>your own numbers.</em>']],
    taps: [[1.0, 'ai-input'], [3.3, 'ai-send']],
    render(u) {
      setDev(A, camAt(u, [[0, cam()], [8.0, cam()], [8.6, cam({ s: 1.4, y: 1200 })], [10, cam({ s: 1.4, y: 1200 })]]));
      screens(A, { ai: 1 });
      const n = clamp(Math.floor((u - 1.2) / 0.045), 0, Q.length);
      const sent = u >= 3.4;
      html('ai-input', sent ? 'Ask anything…' : n ? `<span style="color:var(--ink)">${Q.slice(0, n)}</span><span class="caret"></span>` : 'Ask anything…');
      const q = $('ai-q'); const qp = seg(u, 3.4, 3.7, E.outBack); q.style.display = sent ? '' : 'none'; q.style.transform = `scale(${lerp(0.85, 1, qp)})`; q.style.transformOrigin = '100% 100%';
      const dotsOn = u >= 3.8 && u < 5.0; $('ai-dots').style.display = dotsOn ? '' : 'none';
      [0, 1, 2].forEach((i) => { $('ai-d' + i).style.transform = `translateY(${-5 * Math.max(0, Math.sin((u * 7) - i * 0.9))}px)`; });
      const ans = u >= 5.0; $('ai-a').style.display = ans ? '' : 'none';
      const full = 'Kilimanjaro 500ml — TSh 118,800 profit from 132 bottles. Konyagi is second at TSh 75,600, with the best margin per bottle.';
      const words = full.split(' ');
      text('ai-a-t', words.slice(0, clamp(Math.floor((u - 5.0) / 0.05), 0, words.length)).join(' '));
      $('ai-tbl').style.opacity = seg(u, 6.3, 6.7);
      const ins = $('ai-ins'); ins.style.display = u >= 7.0 ? '' : 'none'; ins.style.opacity = seg(u, 7.0, 7.4);
      const c = $('cl-ins'); const p = seg(u, 8.4, 9.0, E.outBack);
      place(c, { x: CX, y: 520, s: lerp(0.6, 1, p), o: clamp(p * 1.4) * (1 - seg(u, 9.9, 10.3)) });
    },
    callouts: [`<div class="abs callout" id="cl-ins" style="width:860px;background:#fff"><div class="row" style="gap:18px;align-items:flex-start"><div class="ico" style="width:70px;height:70px;border-radius:20px;background:var(--brandSoft);color:var(--brand)">${ic('spark', 34)}</div><div style="font-size:34px;font-weight:700;line-height:1.3"><span style="color:var(--brand)">Bermi noticed:</span> Konyagi runs out by Thursday. Reorder on Wednesday.</div></div></div>`],
  });

  // 11 — Every branch
  chapter({
    num: '11', title: 'Every branch', sub: 'One account for all your businesses — one at a time, or all together.', glyph: 'building', D: 8,
    caps: [[0.9, 8.2, 'Every branch.<br><em>One account.</em>']],
    taps: [[1.1, 'oh-bizbtn'], [2.6, 'sw-all']],
    render(u) {
      setDev(A, cam());
      screens(A, { ohome: 1 });
      sheet('sw-sheet', seg(u, 1.2, 1.6, E.out) * (1 - seg(u, 2.8, 3.1)), 'sw-scrim');
      const all = u >= 2.7;
      show('sw-k-c', all ? 0 : 1); show('sw-m-c', 0); show('sw-all-c', all ? 1 : 0);
      text('oh-biz', all ? 'All businesses' : 'Kilimanjaro Bar');
      text('oh-sub', all ? 'Kilimanjaro Bar + Mbuyuni Lounge' : 'Tuesday 29 September');
      const k = seg(u, 3.1, 4.1, E.out);
      text('oh-sales', tsh(lerp(175000, 312000, all ? k : 0))); text('oh-profit', tsh(lerp(46450, 83100, all ? k : 0)));
      const combo = $('oh-combo'); combo.style.display = all ? '' : 'none'; combo.style.opacity = seg(u, 3.1, 3.6);
      $('oh-alert').style.display = all ? 'none' : '';
      const c1 = $('cl-b1'), c2 = $('cl-b2');
      const p = seg(u, 4.3, 5.0, E.outBack), m = seg(u, 6.0, 6.8, E.inOut);
      place(c1, { x: lerp(CX - 180, CX, m), y: lerp(1540, 1620, m), s: lerp(0.6, 1, p) * (1 - m * 0.2), r: -3 * (1 - m), o: clamp(p * 1.4) * (1 - m) });
      place(c2, { x: lerp(CX + 180, CX, m), y: lerp(1700, 1620, m), s: lerp(0.6, 1, p) * (1 - m * 0.2), r: 3 * (1 - m), o: clamp(p * 1.4) * (1 - m) });
      const c3 = $('cl-b3'); place(c3, { x: CX, y: 1620, s: lerp(0.8, 1, seg(u, 6.4, 7.0, E.outBack)), o: seg(u, 6.4, 6.8) * (1 - seg(u, 7.9, 8.3)) });
    },
    callouts: [['cl-b1', 'Kilimanjaro Bar', 'TSh 175,000', 'var(--brand)'], ['cl-b2', 'Mbuyuni Lounge', 'TSh 137,000', 'var(--vio)'], ['cl-b3', 'All businesses', 'TSh 312,000', 'var(--ok)']].map(([id, n, v, c]) => `<div class="abs callout" id="${id}" style="width:600px;padding:22px 26px"><div class="row" style="gap:16px"><div class="ico" style="width:60px;height:60px;border-radius:18px;background:${c};color:#fff">${ic(id === 'cl-b3' ? 'grid' : 'building', 28)}</div><div style="flex:1"><div style="font-size:26px;font-weight:800">${n}</div><div style="font-size:19px;color:var(--ink2);font-weight:600">Sales today</div></div><div style="font-family:var(--display);font-size:36px;font-weight:800">${v}</div></div></div>`),
  });

  // 12 — Your language, your light
  chapter({
    num: '12', title: 'Your language, your light', sub: 'Kiswahili or English. Light or dark.', glyph: 'globe', D: 6,
    caps: [[0.9, 6.2, 'Kiswahili or English.<br><em>Light or dark.</em>']],
    taps: [[1.0, 'set-lang'], [3.0, 'set-dark']],
    render(u) {
      setDev(A, cam());
      const sw = seg(u, 1.15, 1.7, E.inOut);
      [A.screens.set, A.screens.setD].forEach((s) => s.querySelectorAll('.lx').forEach((n) => {
        const w = sw < 0.5 ? n.dataset.en : n.dataset.sw;
        text(n, w);
        n.style.opacity = Math.abs(sw - 0.5) * 2;
        n.style.display = 'inline-block';
        n.style.transform = `translateY(${(sw < 0.5 ? -sw : 1 - sw) * 16}px)`;
      }));
      // dark: a circle grows from the toggle
      const d = seg(u, 3.1, 4.0, E.inOut);
      const t = sp('set-dark');
      A.screens.setD.style.clipPath = `circle(${d * 1100}px at ${t.x}px ${t.y}px)`;
      screens(A, { set: 1, setD: d > 0 ? 1 : 0 });
      statusLight(A, d > 0.5);
      const b1 = $('cl-lang'), b2 = $('cl-dark');
      const p1 = seg(u, 1.5, 2.1, E.outBack), p2 = seg(u, 3.8, 4.4, E.outBack);
      place(b1, { x: CX, y: 1600, s: lerp(0.7, 1, p1), o: clamp(p1 * 1.4) * (1 - seg(u, 3.2, 3.5)) });
      place(b2, { x: CX, y: 1600, s: lerp(0.7, 1, p2), o: clamp(p2 * 1.4) * (1 - seg(u, 5.8, 6.2)) });
    },
    callouts: [`<div class="abs badge" id="cl-lang"><span style="color:var(--sky)">${ic('globe', 34)}</span> English · Kiswahili</div>`, `<div class="abs badge" id="cl-dark" style="background:#141828;color:#fff"><span style="color:#9b83ff">${ic('moon', 34)}</span> Light · Dark</div>`],
  });

  // 13 — Pay your way
  chapter({
    num: '13', title: 'Pay your way', sub: 'Monthly, quarterly or yearly — straight from mobile money.', glyph: 'card', D: 8,
    caps: [[0.9, 3.9, 'Monthly, quarterly<br>or <em>yearly.</em>'], [4.2, 8.2, 'Paid by <em>mobile money</em>,<br>switched on by itself.']],
    taps: [[0.9, 'pr-1'], [1.7, 'pr-2'], [2.5, 'pr-1'], [3.2, 'pr-pay'], [4.1, 'pay-go']],
    render(u) {
      setDev(A, cam());
      screens(A, { price: 1 });
      const per = u >= 2.55 ? 1 : u >= 1.75 ? 2 : u >= 0.95 ? 1 : 0;
      [0, 1, 2].forEach((i) => ($('pr-' + i).className = i === per ? 'on' : ''));
      const P_ = [['TSh 79,500', '$30 · per month', '', 'Pay TSh 79,500'], ['TSh 214,650', '$81 · for 3 months', 'Save TSh 23,850', 'Pay TSh 214,650'], ['TSh 795,000', '$300 · per year', '2 months free', 'Pay TSh 795,000']][per];
      text('pr-price', P_[0]); text('pr-per', P_[1]); text('pr-save', P_[2]); show('pr-save', P_[2] ? 1 : 0); text('pr-pay-t', P_[3]);
      sheet('pay-sheet', seg(u, 3.3, 3.65, E.out) * (1 - seg(u, 4.3, 4.6)), 'pay-scrim');
      const us = $('ussd'); const up = seg(u, 4.5, 4.9, E.outBack) * (1 - seg(u, 6.0, 6.3));
      us.style.transform = `scale(${lerp(0.85, 1, up)})`; show(us, clamp(up * 1.3));
      const n = [5.0, 5.2, 5.4, 5.6].filter((x) => u >= x).length;
      [...$('ussd-dots').children].forEach((d, i) => (d.className = i < n ? 'on' : ''));
      const done = seg(u, 6.3, 6.7, E.outBack);
      const s = $('pr-strip'); s.style.transform = `scale(${lerp(0.9, 1, done)})`; show(s, clamp(done * 1.3));
      const c = $('cl-free'); const p = seg(u, 1.8, 2.3, E.outBack);
      place(c, { x: CX, y: 1660, s: lerp(0.7, 1, p), o: clamp(p * 1.4) * (1 - seg(u, 2.5, 2.8)) });
      const c2 = $('cl-paid'); const p2 = seg(u, 6.6, 7.2, E.outBack);
      place(c2, { x: CX, y: 1660, s: lerp(0.7, 1, p2), o: clamp(p2 * 1.4) * (1 - seg(u, 7.9, 8.3)) });
    },
    callouts: [`<div class="abs badge" id="cl-free"><span style="color:var(--ok)">${ic('spark', 34)}</span> Pay yearly · 2 months free</div>`, `<div class="abs badge" id="cl-paid"><span style="color:var(--ok)">${ic('check', 34, 3)}</span> Payment received · plan is on</div>`],
  });

  // ------------------------------------------------------------------ timings
  const INTRO = 18.6;
  let c = INTRO;
  CH.forEach((ch) => { ch.C = c; ch.U0 = c + 1.2; c += 1.2 + ch.D; });
  const FIN = c; // finale starts when the last demo hands over
  const DUR = Math.round((FIN + 16) * 30) / 30;

  CH.forEach((ch) => {
    ch.callouts.forEach((h) => el(L.callouts, h));
    ch.caps.forEach(([a, b, h]) => cap(ch.U0 + a, ch.U0 + b, h));
  });
  // cold open, title and finale captions
  cap(1.3, 4.6, "It's 11 pm.", 470);
  cap(2.6, 4.6, '<em>The bar is closing.</em>', 570);
  cap(FIN + 1.2, FIN + 6.4, 'Run your business<br><em>as one system.</em>', 230);
  const OWNED = [...L.callouts.children];

  // ------------------------------------------------------------------ finale wall (copies of the real screens)
  const WALL = [];
  const wallScreens = [['A', 'stock'], ['A', 'cash'], ['A', 'reports'], ['B', 'appr'], ['A', 'ai'], ['A', 'shome'], ['A', 'set'], ['A', 'price']];
  const wallPos = [[-330, -560], [330, -560], [-390, 0], [390, 0], [-330, 560], [330, 560], [0, -780], [0, 800]];
  function buildWall() {
    wallScreens.forEach(([d, k], i) => {
      const src = (d === 'A' ? A : B).screens[k];
      const mini = el(L.wall, `<div class="abs" style="width:462px;height:964px;border-radius:74px;padding:16px;background:linear-gradient(145deg,#6d717c,#15171c 50%,#7b7f8a);box-shadow:0 40px 90px rgba(0,0,0,.5)"><div style="position:relative;width:430px;height:932px;border-radius:58px;overflow:hidden;background:var(--bg)"></div></div>`);
      const clone = src.cloneNode(true);
      clone.removeAttribute('id'); clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      clone.querySelectorAll('.sheet,.scrim,#ussd').forEach((n) => n.remove());
      clone.style.opacity = 1; clone.style.visibility = 'visible'; clone.style.transform = '';
      mini.firstElementChild.appendChild(clone);
      WALL.push({ e: mini, p: wallPos[i], z: i % 2 ? 0.55 : 0.48 });
    });
  }

  // ------------------------------------------------------------------ title + brand
  const markTile = el(L.brand, `<div class="abs" style="width:230px;height:230px;border-radius:58px;background:#fff;display:grid;place-items:center;box-shadow:0 40px 110px rgba(47,91,255,.45)"><img src="mark.svg" style="width:184px;height:184px"></div>`);
  const word = el(L.brand, `<div class="abs wordmark">Bermi One</div>`);
  const tag1 = el(L.brand, `<div class="abs" style="font-size:40px;font-weight:600;color:#c9d2f0;white-space:nowrap">One system for every business.</div>`);
  const tag2 = el(L.brand, `<div class="abs" style="font-size:30px;font-weight:600;color:#8e9cc8;white-space:nowrap;letter-spacing:.3px">Live for bars &amp; lounges today.</div>`);
  const mainDot = el(L.top, `<div class="abs dot"></div>`);

  // ------------------------------------------------------------------ renderAt
  let built = false;
  function renderAt(t) {
    t = ((t % DUR) + DUR) % DUR;
    OWNED.forEach((e) => show(e, 0));
    hideDots();
    WALL.forEach((w) => show(w.e, 0));
    [markTile, word, tag1, tag2].forEach((e) => show(e, 0));
    show(L.paper, 0);
    show(capBand, 0);
    show(chap, 0);
    keyboard(0);
    [A, B].forEach((d) => { d.tap.style.opacity = 0; statusLight(d, false); });
    setDev(B, { o: 0 });

    // bokeh: warm lights of a bar at night — strongest in the cold open and finale
    const bk = Math.max(band(t, 0.2, 9.5, 1.4, 1.5), band(t, FIN, DUR, 1.0, 2.6) * 0.7, 0.18);
    BOKEH.forEach((b, i) => {
      // whole cycles over the film's length, so the lights sit in the same place on the first frame and the last
      const cyc = (2 * Math.PI * t) / DUR;
      const drift = Math.sin(cyc * Math.max(1, Math.round(7 * b.z)) + b.ph) * 30;
      place(b.e, { x: b.x + drift, y: b.y + Math.cos(cyc * 6 + b.ph) * 20, s: b.z, o: bk * (0.25 + 0.55 * b.hue) * (i % 3 === 0 ? 1 : 0.7), blur: (1.3 - b.z) * 8 });
    });

    // ===== cold open (0–10) and title (9.5–18.6)
    if (t < INTRO + 0.6) {
      const rise = seg(t, 3.6, 5.8, E.out);
      const push = seg(t, 7.8, 9.6, E.inOut);
      setDev(A, { x: CX, y: lerp(2400, 1120, rise) + push * 200, s: lerp(1.28, 2.6, push), ry: lerp(-16, -6, rise) * (1 - push), rx: lerp(8, 3, rise) * (1 - push), o: (1 - seg(t, 9.0, 9.6)) * (t > 3.5 ? 1 : 0), fy: lerp(466, 380, push) });
      screens(A, { lock: 1 });
      statusLight(A, true);
      const bp = seg(t, 6.0, 6.4, E.outBack);
      $('banA').style.transform = `translateY(${(1 - bp) * -60}px) scale(${lerp(0.9, 1, bp)})`; show('banA', clamp(bp * 1.4));
      // title
      const m = seg(t, 10.0, 11.3, E.outExpo);
      place(markTile, { x: CX, y: 720, s: lerp(0.85, 1, m) * (1 + 0.01 * Math.sin(Math.PI * seg(t, 10.8, 12))), o: m * (1 - seg(t, 17.6, 18.4)) });
      const w = seg(t, 11.4, 12.4, E.outExpo);
      place(word, { x: CX, y: 1000 - (1 - w) * 20, o: w * (1 - seg(t, 17.6, 18.4)) });
      const g1 = seg(t, 12.6, 13.4, E.out), g2 = seg(t, 13.6, 14.4, E.out);
      place(tag1, { x: CX, y: 1110 - (1 - g1) * 14, o: g1 * (1 - seg(t, 17.6, 18.4)) });
      place(tag2, { x: CX, y: 1180 - (1 - g2) * 14, o: g2 * (1 - seg(t, 17.6, 18.4)) });
    }

    // the loop point: frame 0 and the last frame
    {
      let dp = null;
      if (t < 1.4) dp = { x: P.x, y: P.y, s: 1 + seg(t, 0.2, 1.3) * 2, o: 1 - seg(t, 0.4, 1.3) };
      if (t >= FIN + 12.6) {
        const born = seg(t, FIN + 12.6, FIN + 13.4, E.out);
        const go = seg(t, FIN + 13.4, DUR - 0.25, E.inOut);
        const c = bez({ x: CX, y: 1060 }, { x: CX + 120, y: 1100 }, { x: P.x - 80, y: P.y + 40 }, P, go);
        dp = { x: c.x, y: c.y, s: lerp(2.2, 1, born) * (1 + 0.2 * Math.sin(Math.PI * go)), o: born };
      }
      if (dp) place(mainDot, dp); else show(mainDot, 0);
    }

    // ===== chapters
    const k = CH.findIndex((ch, i) => t >= ch.C + 0.5 && t < (CH[i + 1] ? CH[i + 1].C + 0.5 : FIN + 0.6));
    if (k >= 0) {
      const ch = CH[k];
      const u = t - ch.U0;
      show(capBand, 1);
      ch.render(u);
      drawTaps(u, ch.taps);
    }
    // chapter cards
    CH.forEach((ch) => {
      const lt = t - ch.C;
      if (lt < 0 || lt > 2.2) return;
      const pin = seg(lt, 0, 0.5, E.inOut), pout = seg(lt, 1.7, 2.2, E.inOut);
      chap.style.transform = `translateY(${(1 - pin) * 1920 - pout * 1920}px)`;
      chap.style.borderRadius = pin < 1 ? '60px 60px 0 0' : pout > 0 ? '0 0 60px 60px' : '0';
      show(chap, 1);
      text('ch-num', 'CHAPTER ' + ch.num); text('ch-ttl', ch.title); text('ch-sub', ch.sub);
      const ttl = $('ch-ttl'); ttl.style.fontSize = ch.title.length > 17 ? '122px' : '150px';
      $('ch-sub').style.top = (745 + ttl.offsetHeight + 46) + 'px';
      html('ch-glyph', ic(ch.glyph, 150, 1.6));
      const a = seg(lt, 0.35, 0.9, E.outExpo);
      $('ch-ttl').style.transform = `translateY(${(1 - a) * 40}px)`; $('ch-ttl').style.opacity = a;
      $('ch-sub').style.opacity = seg(lt, 0.6, 1.1); $('ch-num').style.opacity = seg(lt, 0.3, 0.7);
      $('ch-line').style.transform = `scaleX(${seg(lt, 0.3, 0.9, E.outExpo)})`;
      $('ch-glyph').style.transform = `translateY(${(1 - a) * 30 - pout * 120}px) rotate(${(1 - a) * -8}deg)`;
    });

    // ===== finale
    if (t >= FIN) {
      const u = t - FIN;
      const gather = seg(u, 6.0, 7.2, E.in);
      setDev(A, { x: CX, y: lerp(lerp(1135, 1060, seg(u, 0, 1)), 1060, gather), s: lerp(lerp(1.62, 0.6, seg(u, 0, 1.2, E.inOut)), 0.3, gather), o: 1 - seg(u, 6.8, 7.3), ry: Math.sin(u * 0.6) * 6 * (1 - gather) });
      screens(A, { price: 1 - seg(u, 0, 0.5), ohome: seg(u, 0, 0.5) });
      sheet('sw-sheet', 0, 'sw-scrim');
      text('oh-biz', 'Kilimanjaro Bar'); text('oh-sales', tsh(175000)); text('oh-profit', tsh(46450)); $('oh-combo').style.display = 'none'; $('oh-alert').style.display = '';
      show(capBand, seg(u, 0.4, 1.2) * (1 - seg(u, 6.0, 6.6)));
      WALL.forEach((w, i) => {
        const ap = seg(u, 0.3 + i * 0.1, 1.3 + i * 0.1, E.outExpo);
        const drift = Math.sin(u * 0.5 + i) * 14;
        place(w.e, { x: lerp(CX, CX + w.p[0] * 1.05, ap * (1 - gather)) + drift, y: lerp(1060, 1060 + w.p[1], ap * (1 - gather)), s: lerp(0.2, w.z, ap) * (1 - gather * 0.6), r: (i % 2 ? 2 : -2) * (1 - gather), o: ap * (1 - seg(u, 6.6, 7.2)), blur: i >= 6 ? 1.5 : 0 });
      });
      const m = seg(u, 7.4, 8.6, E.outExpo), out = seg(u, 11.6, 12.6, E.inOut);
      place(markTile, { x: CX, y: 760, s: lerp(0.85, 1, m) * (1 - out * 0.1), o: m * (1 - out) });
      const w = seg(u, 8.4, 9.4, E.outExpo);
      place(word, { x: CX, y: 1030 - (1 - w) * 20, o: w * (1 - out) });
      const g = seg(u, 9.3, 10.1, E.out);
      place(tag1, { x: CX, y: 1140, o: g * (1 - out) });
      place(tag2, { x: CX, y: 1210, o: seg(u, 9.8, 10.6) * (1 - out) });
    }

    drawCaps(t);
  }

  // ------------------------------------------------------------------ sound cues
  const EVENTS = [];
  const ev = (t, type, gain = 1) => EVENTS.push({ t: +t.toFixed(3), type, gain });
  ev(0.3, 'bloom', 0.8); ev(3.6, 'rise', 0.6); ev(6.0, 'notify', 0.9); ev(6.0, 'haptic', 0.8); ev(8.0, 'whoosh', 0.7);
  ev(10.0, 'logo', 0.9); ev(11.4, 'shimmer', 0.6);
  CH.forEach((ch, i) => {
    ev(ch.C, 'card', 0.8); ev(ch.C + 1.7, 'whoosh', 0.45);
    ch.taps.forEach(([u, target]) => ev(ch.U0 + u, typeof target === 'string' && target.startsWith('k-') ? 'key' : 'tap', 0.8));
  });
  const at = (k, u) => CH[k].U0 + u;
  // chapter-specific moments
  ev(at(0, 2.75), 'swipe', 0.5); ev(at(0, 5.2), 'success', 0.8); ev(at(0, 6.2), 'pop', 0.6); ev(at(0, 7.0), 'pop', 0.6);
  ev(at(1, 1.6), 'pop', 0.6); ev(at(1, 7.6), 'pop', 0.6);
  ev(at(2, 1.2), 'sheet', 0.6); ev(at(2, 4.4), 'drop', 1); ev(at(2, 5.0), 'success', 0.8); ev(at(2, 6.3), 'pop', 0.6);
  ev(at(3, 6.6), 'pop', 0.6); ev(at(3, 7.6), 'count', 0.7); ev(at(3, 10.2), 'swipe', 0.5);
  ev(at(4, 5.05), 'sheet', 0.6); [9.0, 9.3, 9.6].forEach((u) => ev(at(4, u), 'pop', 0.55));
  ev(at(5, 1.08), 'success', 0.8); ev(at(5, 1.6), 'whoosh', 0.6); ev(at(5, 2.4), 'stream', 0.8); ev(at(5, 3.4), 'notify', 1); ev(at(5, 3.4), 'haptic', 1); ev(at(5, 4.7), 'whoosh', 0.6); ev(at(5, 5.4), 'count', 0.6); ev(at(5, 8.35), 'confirm', 1);
  [1.4, 2.0, 2.6].forEach((u) => ev(at(6, u), 'flip', 0.7)); ev(at(6, 3.6), 'pop', 0.6);
  [1.0, 1.6, 2.2, 2.8].forEach((u) => ev(at(7, u), 'pop', 0.5)); ev(at(7, 5.6), 'count', 0.6);
  ev(at(8, 0.9), 'count', 0.5); ev(at(8, 5.9), 'paper', 0.9); ev(at(8, 8.8), 'sheet', 0.7); ev(at(8, 10.6), 'sent', 0.9);
  for (let i = 0; i < Q.length; i += 2) ev(at(9, 1.2 + i * 0.045), 'type', 0.35);
  ev(at(9, 3.4), 'sent', 0.7); ev(at(9, 5.0), 'reply', 0.8); ev(at(9, 7.0), 'notify', 0.6);
  ev(at(10, 1.2), 'sheet', 0.6); ev(at(10, 3.1), 'count', 0.6); ev(at(10, 6.0), 'merge', 0.8);
  ev(at(11, 1.15), 'swipe', 0.5); ev(at(11, 3.1), 'dark', 0.8);
  ev(at(12, 3.3), 'sheet', 0.6); ev(at(12, 4.5), 'notify', 0.8); [5.0, 5.2, 5.4, 5.6].forEach((u) => ev(at(12, u), 'key', 0.6)); ev(at(12, 6.3), 'confirm', 1);
  ev(FIN + 0.2, 'impact', 0.9); ev(FIN + 6.0, 'reverse', 0.8); ev(FIN + 7.4, 'logo', 1); ev(FIN + 12.6, 'bloom', 0.5);
  EVENTS.sort((a, b) => a.t - b.t);

  // ------------------------------------------------------------------ boot
  window.DUR = DUR;
  window.FIN = FIN;
  window.CHAPTERS = CH.map((c) => ({ num: c.num, title: c.title, start: +c.C.toFixed(2), demo: +c.U0.toFixed(2), D: c.D }));
  window.EVENTS = EVENTS;
  window.renderAt = renderAt;
  window.ready = document.fonts.ready.then(() => Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null)))).then(() => {
    // lay everything out at rest for measuring
    ['sh-add', 'sh-item', 'sw-sheet', 'pay-sheet'].forEach((id) => { $(id).style.transform = 'none'; });
    kbd.style.transform = 'none';
    measure();
    buildWall();
    renderAt(0);
    return true;
  });
  if (/[?&]play/.test(location.search)) window.ready.then(() => { const t0 = performance.now(); const loop = () => { renderAt(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); });
  const m = /[?&]t=([\d.]+)/.exec(location.search);
  if (m) window.ready.then(() => renderAt(parseFloat(m[1])));
})();
