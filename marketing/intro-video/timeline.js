/*
  Bermi One — introduction film.

  One function, renderAt(t), places every element for time t (seconds). Nothing
  animates on its own, so render.mjs can step through 2,250 frames and each one
  is exact. EVENTS lists every moment that makes a sound; audio.py reads the
  same list, which is what keeps clicks on clicks.

  The story uses Bermi One's real features and the same data the app shows:
  Kilimanjaro Bar, Joseph Mtei counting, Neema Mushi verifying, TSh amounts
  that add up (72 − 41 = 31 × 3,500 = 108,500 …).
*/
(function () {
  const DUR = 75;
  const W = 1920, H = 1080, CX = 960, CY = 540;
  const P = { x: 168, y: 566 }; // where the loop point lives — last frame and first frame

  // ------------------------------------------------------------------ helpers
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    lin: (p) => p,
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    out: (p) => 1 - Math.pow(1 - p, 3),
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    in: (p) => p * p * p,
    outBack: (p) => { const c1 = 1.25, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    sine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  };
  const seg = (t, a, b, e = E.inOut) => e(clamp((t - a) / (b - a)));
  const win = (t, a, b, fadeIn = 0.3, fadeOut = 0.3, e = E.out) =>
    Math.min(seg(t, a, a + fadeIn, e), 1 - seg(t, b - fadeOut, b, E.inOut));
  const fmt = (v) => 'TSh ' + Math.round(v).toLocaleString('en-US');
  const num = (v) => Math.round(v).toLocaleString('en-US');

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = rng(7);
  const rr = (a, b) => a + (b - a) * R();

  function el(parent, html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    const e = d.firstElementChild;
    parent.appendChild(e);
    return e;
  }
  /** Centre-anchored placement. */
  function place(e, { x = CX, y = CY, s = 1, o = 1, r = 0, blur = 0 }) {
    e.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s}) rotate(${r}deg)`;
    e.style.opacity = o;
    e.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
    e.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
  }
  function show(e, o) { e.style.opacity = o; e.style.visibility = o <= 0.002 ? 'hidden' : 'visible'; }
  function text(id, s) { const e = typeof id === 'string' ? document.getElementById(id) : id; if (e && e.textContent !== s) e.textContent = s; }
  function html(id, s) { const e = document.getElementById(id); if (e && e._h !== s) { e.innerHTML = s; e._h = s; } }

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
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    bottle: '<path d="M10 2h4v4l2 3v12a1 1 0 01-1 1H9a1 1 0 01-1-1V9l2-3z"/>',
    inbox: '<path d="M12 15V3"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    book: '<path d="M4 4h7a3 3 0 013 3v13a2 2 0 00-2-2H4z"/><path d="M20 4h-4a3 3 0 00-3 3"/><path d="M20 4v14h-6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
  };
  const ic = (n, s = 18, sw = 2) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;

  // ------------------------------------------------------------------ stage
  const stage = document.getElementById('stage');
  const L = {};
  ['glow', 's1', 'scrim', 's2', 'lines4', 'ringB', 'lines6', 'app', 'mods', 'ringA', 'wf', 'texts', 'brand', 'top'].forEach((k) => {
    L[k] = el(stage, `<div class="layer" id="L-${k}"></div>`);
  });

  const glow = el(L.glow, `<div class="abs" style="width:1100px;height:1100px;border-radius:50%;background:radial-gradient(circle,rgba(70,100,255,.42) 0%,rgba(107,75,255,.16) 32%,rgba(6,8,18,0) 66%)"></div>`);
  const scrim = el(L.scrim, `<div class="layer" style="background:radial-gradient(1100px 600px at 50% 50%,rgba(6,8,18,.82),rgba(6,8,18,.55))"></div>`);

  // ------------------------------------------------------------------ scene 1: fragments
  const s1cam = el(L.s1, `<div class="layer" style="transform-origin:50% 50%"></div>`);
  const CHIP_LABELS = ['STOCK', 'CASH', 'STAFF', 'RECEIPTS', 'MOBILE MONEY', 'SPREADSHEETS', 'CHATS', 'NOTEBOOK', 'REPORTS', 'DELIVERIES', 'DEBTS', 'PRICES', 'SUPPLIERS', 'SHIFTS', 'EXPENSES', 'CUSTOMERS'];
  const chips = CHIP_LABELS.map((label, i) => {
    const z = i === 0 ? 1 : rr(0.58, 1.18);
    let x, y;
    if (i === 0) { x = P.x; y = P.y; } else {
      // keep the middle band for the line of type that comes later
      do { x = rr(140, 1780); y = rr(110, 970); } while (Math.abs(y - 540) < 120 && Math.abs(x - 960) < 560);
    }
    return {
      e: el(s1cam, `<div class="abs chip">${label}</div>`),
      z, x, y,
      vx: i === 0 ? 26 : rr(-34, 34) * z, vy: i === 0 ? -9 : rr(-20, 20) * z,
      ph: rr(0, 6.28),
      a: i === 0 ? 0.12 : 0.45 + i * 0.2,
    };
  });

  const WINS = [
    { w: 560, h: 330, x: 520, y: 350, a: 2.3, title: 'stock_sept_FINAL(3).xlsx', body: sheetBody() },
    { w: 400, h: 430, x: 1420, y: 370, a: 2.65, title: 'Joseph · Bar', body: `<div class="chat"><div class="bub">Boss, crate count is short again 😕<small>22:41</small></div><div class="bub">Who took the 2 Konyagi?<small>22:42</small></div><div class="bub me">Send me the numbers tomorrow<small>22:50</small></div><div class="bub">Notebook got wet…<small>23:04</small></div></div>` },
    { w: 480, h: 330, x: 770, y: 740, a: 3.0, title: 'Notebook — Tuesday', body: `<div class="paper">Kili 72 → <s>40</s> 41?<br>Serengeti 36 … 29<br>Konyagi 18 – <s>12</s> 11<br>Cash 98,000 + ???</div>` },
    { w: 300, h: 400, x: 1660, y: 760, a: 3.35, title: 'Calculator', body: `<div class="calc"><div class="scr">173,500</div>${['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+'].map((k,i)=>`<span class="${i%4===3?'o':''}">${k}</span>`).join('')}</div>` },
    { w: 420, h: 196, x: 1150, y: 830, a: 3.7, title: 'Messages', body: `<div class="sms"><div class="from">Mobile money</div>Confirmed. You have received TSh 12,000 from 0754 ••• 211. Balance TSh 77,000.</div>` },
    { w: 470, h: 250, x: 1040, y: 250, a: 4.05, title: 'Re: weekly numbers', body: `<div class="mail"><h4>Weekly report</h4>Sales by day, stock left, money banked…<br>Still waiting on Tuesday's sheet.<div class="miss">Tuesday missing</div></div>` },
  ];
  WINS.forEach((w) => {
    w.e = el(s1cam, `<div class="abs win" style="width:${w.w}px;height:${w.h}px"><div class="win-bar"><i></i><i></i><i></i><b>${w.title}</b></div><div style="height:${w.h - 36}px">${w.body}</div></div>`);
    w.vx = rr(-16, 16); w.vy = rr(-11, 11); w.vr = rr(-0.5, 0.5); w.r0 = rr(-2.2, 2.2);
  });
  const notif = el(s1cam, `<div class="abs notif"><div class="ic" style="background:var(--badSoft);color:var(--bad)">${ic('bell', 20)}</div><div><b>3 unread · Supplier</b><span>Invoice #0471 doesn't match delivery</span></div></div>`);

  function sheetBody() {
    const rows = [['', 'A', 'B', 'C', 'D', 'E'], ['1', 'Item', 'Open', 'In', 'Close', 'Sold'], ['2', 'Kili 500', '72', '24', '41', '#REF!'], ['3', 'Seren.', '36', '0', '29', '7'], ['4', 'Konyagi', '18', '6', '?', '#N/A'], ['5', 'Total', '', '', '', '=SUM(…'], ['6', '', '', '', '', ''], ['7', '', '', '', '', '']];
    return `<div class="sheet">${rows.map((r, i) => r.map((c, j) => `<div class="${i === 0 || j === 0 ? 'h' : ''} ${/#/.test(c) ? 'err' : ''}">${c}</div>`).join('')).join('')}</div>`;
  }

  const t1 = kinetic(L.texts, "Your business shouldn't feel like this.", 'lg', 540);
  function kinetic(parent, str, cls, y) {
    const e = el(parent, `<div class="kin ${cls}">${str.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ')}</div>`);
    e.style.top = y + 'px';
    e.style.transform = 'translateY(-50%)';
    e._words = [...e.querySelectorAll('.w')];
    return e;
  }
  /** Words arrive one by one, settle, and leave together. */
  function words(e, t, start, stagger, end, exit = 0.4) {
    const out = seg(t, end, end + exit, E.inOut);
    e._words.forEach((w, i) => {
      const p = seg(t, start + i * stagger, start + i * stagger + 0.55, E.outExpo);
      w.style.opacity = p * (1 - out);
      w.style.transform = `translateY(${(1 - p) * 34 - out * 18}px)`;
      w.style.filter = p < 0.98 ? `blur(${((1 - p) * 10).toFixed(2)}px)` : 'none';
    });
    e.style.visibility = t < start - 0.01 || out >= 1 ? 'hidden' : 'visible';
  }

  // ------------------------------------------------------------------ scene 2: dots
  const DOTS = [];
  for (let j = 0; j < 12; j++) DOTS.push(el(L.s2, `<div class="abs dot sm"></div>`));

  // ------------------------------------------------------------------ the product
  const appWrap = el(L.app, `<div id="appWrap"></div>`);
  const app = el(appWrap, `<div class="app"></div>`);
  app.innerHTML = `
  <aside class="side">
    <div class="side-biz"><div class="side-mark">${ic('bottle', 17)}</div><div style="flex:1;min-width:0"><b>Kilimanjaro Bar</b><small>Your business. One system.</small></div><span style="color:var(--ink3)">${ic('down', 14)}</span></div>
    <div class="side-t">Work</div>
    <div class="side-i" id="nav-home">${ic('home')}Home</div>
    <div class="side-i">${ic('box')}Stock</div>
    <div class="side-i" id="nav-close">${ic('check')}Close Day</div>
    <div class="side-i">${ic('wallet')}Money</div>
    <div class="side-i">${ic('chart')}Reports</div>
    <div class="side-i">${ic('spark')}Bermi AI</div>
    <div class="side-t">Business</div>
    <div class="side-i">${ic('grid')}Manage</div>
    <div class="side-i">${ic('user')}Staff</div>
    <div class="side-i">${ic('building')}Business profile</div>
    <div class="side-foot">
      <div class="side-plan">${ic('spark', 14)}<span style="flex:1">Standard · 2 businesses</span></div>
      <div class="side-role"><div class="av">N</div><div><b>Neema Mushi</b><small>Owner</small></div></div>
    </div>
  </aside>
  <div class="main">
    <section class="page" id="pg-home">
      <div class="h1">Good evening, Neema</div>
      <div class="sub">Kilimanjaro Bar · Tuesday 29 September</div>
      <div class="grid2" style="margin-top:24px">
        <div>
          <div class="hero" id="h-hero"><div class="row" style="gap:70px;position:relative;z-index:1">
            <div><div class="k">Sales today</div><div class="v" id="h-sales">—</div></div>
            <div><div class="k">Profit</div><div class="v" id="h-profit">—</div></div>
            <div><div class="k">Cash + mobile</div><div class="v" id="h-cash">—</div></div>
          </div></div>
          <div class="card row" style="margin-top:16px;padding:16px 18px" id="h-alert-card">
            <div class="ico" id="h-alert-ico"></div><div id="h-alert-t" style="font-weight:700;font-size:15px;flex:1"></div><span style="color:var(--ink3)">›</span>
          </div>
          <div class="sec" style="margin:24px 0 12px">Quick actions</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
            ${[['check', 'Close Day', 'brand'], ['box', 'Stock', 'vio'], ['wallet', 'Money', 'sky'], ['spark', 'Ask Bermi', 'ok']].map(([i, l, c]) => `<div class="card" style="padding:18px 8px;display:flex;flex-direction:column;align-items:center;gap:10px"><div class="ico" style="background:var(--${c}Soft);color:var(--${c})">${ic(i)}</div><b style="font-size:13px">${l}</b></div>`).join('')}
          </div>
          <div class="card" style="margin-top:16px;padding:22px 24px">
            <div class="row" style="justify-content:space-between;margin-bottom:18px"><b style="font-size:15px">Last 7 days</b><span class="k">Sales</span></div>
            <div class="bars">${['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'].map((d, i) => `<div><i id="bar-${i}" class="${i === 6 ? 'now' : ''}"></i><span>${d}</span></div>`).join('')}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="card" style="padding:18px"><div class="k">Stock value</div><div class="v" id="h-stock">—</div></div>
            <div class="card" style="padding:18px"><div class="k">Expenses</div><div class="v" id="h-exp">TSh 22,000</div></div>
          </div>
          <div class="card" style="padding:18px">
            <div class="k" style="margin-bottom:12px">On shift</div>
            <div class="row"><div class="av" style="background:linear-gradient(135deg,#0f8fd8,#2f5bff)">J</div><div style="flex:1"><b style="font-size:14px;display:block">Joseph Mtei</b><small style="font-size:12px;color:var(--ink3);font-weight:600">Bar attendant · signed in with PIN</small></div><span class="pill" style="background:var(--okSoft);color:var(--ok)">Active</span></div>
          </div>
          <div class="card" style="padding:18px">
            <div class="k" style="margin-bottom:6px">Low stock</div>
            <div class="row" style="padding:8px 0"><div class="ico" style="width:32px;height:32px;background:var(--warnSoft);color:var(--warn)">${ic('bottle', 15)}</div><b style="flex:1;font-size:14px">Konyagi 250ml</b><b style="color:var(--warn);font-size:14px" id="h-low">18 left</b></div>
          </div>
        </div>
      </div>
    </section>

    <section class="page" id="pg-close">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div><div class="h1">Close a day</div><div class="sub">Tuesday 29 September · counting as <b style="color:var(--ink)">Joseph Mtei</b></div></div>
        <span class="pill" id="c-pill"></span>
      </div>
      <div class="grid2" style="margin-top:26px">
        <div>
          <div class="row sec" style="margin-bottom:10px"><i style="width:9px;height:9px;border-radius:3px;background:var(--brand)"></i>Beer<span style="color:var(--ink3)" id="c-beer">0/2</span></div>
          <div class="card" style="padding:4px 6px;margin-bottom:18px">
            ${prodRow('k', 'Kilimanjaro 500ml', 'Opening 48 + 24 added = 72 bottle · TSh 3,500')}
            ${prodRow('s', 'Serengeti 500ml', 'Opening 36 = 36 bottle · TSh 3,500')}
          </div>
          <div class="row sec" style="margin-bottom:10px"><i style="width:9px;height:9px;border-radius:3px;background:var(--vio)"></i>Spirits<span style="color:var(--ink3)" id="c-spirit">0/1</span></div>
          <div class="card" style="padding:4px 6px">
            ${prodRow('y', 'Konyagi 250ml', 'Opening 12 + 6 added = 18 bottle · TSh 6,000')}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="card row" style="padding:18px">
            <div style="flex:1"><div class="k">Counted</div><div class="v" id="c-counted">0 / 3</div></div>
            <div style="width:1px;align-self:stretch;background:var(--line)"></div>
            <div style="flex:1;text-align:right"><div class="k" id="c-units">0 units sold</div><div class="v" id="c-exp">—</div></div>
          </div>
          <div class="sec">Money collected</div>
          <div class="card" style="padding:6px 10px">
            <div class="row" style="padding:12px 4px;border-bottom:1px solid var(--line)"><div class="ico" style="width:32px;height:32px;background:var(--card2);color:var(--ink2)">${ic('wallet', 15)}</div><b style="flex:1;font-size:14.5px">Cash received</b><div class="inp" id="in-cash" style="width:140px;justify-content:end;padding-right:12px;display:flex;align-items:center"></div></div>
            <div class="row" style="padding:12px 4px"><div class="ico" style="width:32px;height:32px;background:var(--card2);color:var(--ink2)">${ic('phone', 15)}</div><b style="flex:1;font-size:14.5px">Mobile money</b><div class="inp" id="in-mob" style="width:140px;justify-content:end;padding-right:12px;display:flex;align-items:center"></div></div>
          </div>
          <div class="card row" style="padding:14px 18px" id="c-match"><span style="font-size:13.5px;font-weight:700;color:var(--ink2);flex:1">Expected vs counted</span><b id="c-match-t" style="font-size:14px">—</b></div>
          <div class="btnp" id="btn-submit"><span id="btn-submit-t">Submit closing</span></div>
        </div>
      </div>
    </section>

    <div class="toast" id="toast">
      <div class="ico" id="toast-ico" style="width:42px;height:42px;border-radius:13px"></div>
      <div style="flex:1"><b id="toast-t"></b><span id="toast-s"></span><div class="tbtn" id="toast-btn"><span id="toast-btn-t">Verify</span></div></div>
    </div>
  </div>`;

  function prodRow(k, name, sub) {
    return `<div class="prod-wrap" style="border-bottom:1px solid var(--line)"><div class="prod" style="border:none">
      <div class="ico" style="background:var(--brandSoft);color:var(--brand)">${ic('bottle', 16)}</div>
      <div style="flex:1"><b>${name}</b><small>${sub}</small></div>
      <div class="inp" id="in-${k}"></div></div>
      <div class="soldline" id="sold-${k}"></div></div>`;
  }

  const appDim = el(appWrap, `<div style="position:absolute;inset:0;background:#060812;opacity:0;pointer-events:none"></div>`);
  const cursor = el(appWrap, `<svg id="cursor" viewBox="0 0 30 30"><path d="M5 3l19 11.2-8.3 1.6 4.6 8.9-3.4 1.8-4.6-8.9L6 23.9z" fill="#0a1020" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>`);
  const ripple = el(appWrap, `<div class="ripple"></div>`);

  // ------------------------------------------------------------------ scene 4: modules
  const MODS = [
    {
      key: 'stock', label: 'Stock', icon: 'box', c: 'brand', sub: 'Live levels across the bar', slot: [-612, -250],
      body: [['Kilimanjaro 500ml', 41, 72, ''], ['Serengeti 500ml', 29, 36, ''], ['Konyagi 250ml', 11, 18, 'Low']].map(([n, q, m, tg]) =>
        `<div class="mrow"><div class="ico" style="width:34px;height:34px;background:var(--brandSoft);color:var(--brand)">${ic('bottle', 15)}</div><span style="flex:1">${n}</span>${tg ? `<span class="tag" style="background:var(--warnSoft);color:var(--warn)">${tg}</span>` : ''}<div class="meter"><i style="width:${(q / m) * 100}%;${tg ? 'background:var(--warn)' : ''}"></i></div><b style="width:90px;text-align:right">${q} left</b></div>`).join('') +
        `<div class="mrow" style="color:var(--ink2)"><span style="flex:1">Stock value</span><b style="color:var(--ink)">TSh 311,000</b></div>`,
    },
    {
      key: 'close', label: 'Close Day', icon: 'check', c: 'vio', sub: 'Tuesday · counted by Joseph', slot: [612, -250],
      body: [['Counted', '3 / 3 products'], ['Units sold', '45'], ['Sales', 'TSh 175,000'], ['Cash + mobile', 'TSh 175,000']].map(([a, b], i) =>
        `<div class="mrow"><span style="flex:1;color:var(--ink2)">${a}</span><b>${b}</b>${i === 3 ? '<span class="tag" style="background:var(--okSoft);color:var(--ok);margin-left:10px">Matches</span>' : ''}</div>`).join('') +
        `<div style="margin-top:14px"><span class="pill" style="background:var(--okSoft);color:var(--ok)">${ic('check', 13, 3)} Verified by Neema</span></div>`,
    },
    {
      key: 'cash', label: 'Cash Book', icon: 'wallet', c: 'sky', sub: 'Every shilling in and out', slot: [-612, 262],
      body: [['Sales · Tuesday', '+175,000', 'ok'], ['Ice & charcoal', '−12,000', ''], ['Staff advance · Joseph', '−10,000', ''], ['Balance today', 'TSh 153,000', 'b']].map(([a, b, k]) =>
        `<div class="mrow"><div class="ico" style="width:34px;height:34px;background:${k === 'ok' ? 'var(--okSoft)' : 'var(--card2)'};color:${k === 'ok' ? 'var(--ok)' : 'var(--ink2)'}">${ic(k === 'ok' ? 'inbox' : k === 'b' ? 'book' : 'receipt', 15)}</div><span style="flex:1">${a}</span><b style="color:${k === 'ok' ? 'var(--ok)' : 'var(--ink)'}">${b}</b></div>`).join(''),
    },
    {
      key: 'team', label: 'Team', icon: 'users', c: 'ok', sub: 'Each person signs in with a PIN', slot: [612, 262],
      body: [['N', 'Neema Mushi', 'Owner', 'Sees everything'], ['J', 'Joseph Mtei', 'Bar attendant', 'Submitted 22:41'], ['A', 'Amina Said', 'Cashier', 'On shift']].map(([a, n, r, s]) =>
        `<div class="mrow"><div class="av">${a}</div><div style="flex:1"><div>${n}</div><div style="font-size:12.5px;color:var(--ink3);font-weight:600">${r}</div></div><span class="tag" style="background:var(--card2);color:var(--ink2)">${ic('lock', 11, 2.4)} ${s}</span></div>`).join('') +
        `<div style="margin-top:14px;font-size:13.5px;font-weight:700;color:var(--ink2)">Staff record stock and money — they never see profit.</div>`,
    },
    {
      key: 'reports', label: 'Reports', icon: 'chart', c: 'warn', sub: 'Written for you, every day', slot: [0, -392],
      body: `<div class="bars" style="height:150px">${[62, 48, 70, 96, 88, 40, 92].map((v, i) => `<div><i class="${i === 6 ? 'now' : ''}" style="height:${v * 1.3}px"></i><span>${['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'][i]}</span></div>`).join('')}</div>
        <div class="row" style="margin-top:20px;padding:14px 16px;border-radius:16px;background:var(--brandSoft)"><div class="ico" style="width:34px;height:34px;background:#fff;color:var(--brand)">${ic('spark', 16)}</div><div style="font-size:14.5px;font-weight:700;line-height:1.4"><span style="color:var(--brand)">Bermi noticed:</span> Konyagi runs out by Thursday — reorder on Wednesday.</div></div>`,
    },
  ];
  MODS.forEach((m) => {
    m.e = el(L.mods, `<div class="abs mod"><div class="mod-h"><div class="ico" style="background:var(--${m.c}Soft);color:var(--${m.c})">${ic(m.icon, 22)}</div><div><b>${m.label}</b><small>${m.sub}</small></div></div>${m.body}</div>`);
    m.lab = el(L.mods, `<div class="abs label">${m.label}</div>`);
  });
  const svg4 = el(L.lines4, `<svg class="layer" viewBox="0 0 1920 1080"></svg>`);
  MODS.forEach((m) => {
    m.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    m.path.setAttribute('fill', 'none'); m.path.setAttribute('stroke', 'rgba(120,150,255,.55)'); m.path.setAttribute('stroke-width', '2.5');
    m.path.setAttribute('pathLength', '1'); m.path.setAttribute('stroke-dasharray', '1 1');
    svg4.appendChild(m.path);
    m.flow = [0, 1, 2].map(() => el(L.lines4, `<div class="abs dot sm"></div>`));
  });
  const t4 = kinetic(L.texts, 'Every part of your business stays connected.', 'md', 990);

  // ------------------------------------------------------------------ scene 5: workflow
  const wfStrip = el(L.wf, `<div class="layer"></div>`);
  const WF = [
    ['01 · COUNT', 'box', 'Joseph counts the shelves', '3 products · two minutes'],
    ['02 · SUBMIT', 'send', 'Closing submitted', 'Sales TSh 175,000'],
    ['03 · NOTIFY', 'bell', 'Owner gets a ping', 'On her phone, wherever she is'],
    ['04 · VERIFY', 'shield', 'Verified in one tap', 'The count is locked'],
    ['05 · ROLL OVER', 'refresh', 'Stock carries forward', "Tonight's count is tomorrow's opening"],
    ['06 · BOOKS', 'book', 'Cash book posts itself', 'Sales in, expenses out'],
    ['07 · REPORT', 'chart', 'Dashboard & report update', 'Summary ready to share on WhatsApp'],
  ].map(([n, i, b, s], k) => {
    const inner = (on) => `<div class="wf ${on ? 'on' : ''}" style="position:absolute;inset:0"><div class="n">${n}</div><div class="ico">${ic(i, 24)}</div><b>${b}</b><small>${s}</small></div>`;
    const e = el(wfStrip, `<div class="abs" style="width:300px;height:250px">${inner(false)}${inner(true)}</div>`);
    return { e, on: e.children[1], x: k * 370 };
  });
  const WF_LINKS = WF.slice(0, -1).map(() => el(wfStrip, `<div class="abs" style="width:62px;height:4px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden"><i style="display:block;height:100%;width:0;background:linear-gradient(90deg,#2f5bff,#8f7bff)"></i></div>`));
  const token = el(wfStrip, `<div class="abs token"></div>`);
  const TOKENS = ['Counting · 3 products', 'Tuesday · TSh 175,000', 'Ping → Neema', 'Verified ✓', 'Opening Wed · 81 items', 'Cash book +175,000', 'Report ready'];
  const t5a = kinetic(L.texts, 'Less manual work.', 'md', 850);
  const t5b = kinetic(L.texts, 'More control.', 'md', 850);

  // ------------------------------------------------------------------ scene 6: ecosystem
  const TILES = [
    ['Stock', 'box', 'brand', 'Counts, deliveries, low-stock alerts'],
    ['Close Day', 'check', 'vio', 'Count, submit, verify'],
    ['Cash Book', 'wallet', 'sky', 'Every shilling in and out'],
    ['Staff', 'users', 'ok', 'PIN sign-in, no profit shown'],
    ['Reports', 'chart', 'warn', 'Daily, weekly, PDF & WhatsApp'],
    ['Bermi AI', 'spark', 'brand', 'Ask anything about your business'],
    ['Payments', 'card', 'vio', 'Plans paid by mobile money'],
    ['Multi-business', 'building', 'sky', 'Every branch in one account'],
  ].map(([b, i, c, s], k) => {
    const near = k % 2 === 0;
    const e = el(near ? L.ringA : L.ringB, `<div class="abs tile"><div class="ico" style="background:var(--${c}Soft);color:var(--${c})">${ic(i, 21)}</div><b>${b}</b><small>${s}</small></div>`);
    return { e, near, a0: (k / 8) * Math.PI * 2 - Math.PI / 2 };
  });
  const svg6 = el(L.lines6, `<svg class="layer" viewBox="0 0 1920 1080"></svg>`);
  TILES.forEach((tl) => {
    tl.path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tl.path.setAttribute('fill', 'none'); tl.path.setAttribute('stroke', 'rgba(120,150,255,.45)'); tl.path.setAttribute('stroke-width', '2');
    tl.path.setAttribute('pathLength', '1'); tl.path.setAttribute('stroke-dasharray', '1 1');
    svg6.appendChild(tl.path);
    tl.flow = el(L.lines6, `<div class="abs dot sm"></div>`);
  });
  const t6a = kinetic(L.texts, 'One platform.', 'md', 845);
  const t6b = kinetic(L.texts, 'One source of truth.', 'md', 925);

  // ------------------------------------------------------------------ scene 2 / 7 type
  const t2a = kinetic(L.texts, 'One system.', 'lg', 905);
  const t2b = kinetic(L.texts, 'Everything connected.', 'lg', 905);

  const markTile = el(L.brand, `<div class="abs" style="width:188px;height:188px;border-radius:46px;background:#fff;display:grid;place-items:center;box-shadow:0 30px 90px rgba(47,91,255,.35),0 0 0 1px rgba(255,255,255,.4)"><img src="mark.svg" class="mark" alt=""></div>`);
  const t7a = kinetic(L.brand, 'Run your business as one system.', 'lg', 620);
  const t7b = el(L.brand, `<div class="abs wordmark">Bermi One</div>`);
  const t7c = el(L.brand, `<div class="abs kin sm" style="width:auto">Built for modern businesses.</div>`);

  const mainDot = el(L.top, `<div class="abs dot"></div>`);

  // ------------------------------------------------------------------ measure the product
  const POS = {};
  function measure() {
    appWrap.style.transform = 'none';
    const base = appWrap.getBoundingClientRect();
    ['nav-home', 'nav-close', 'in-k', 'in-s', 'in-y', 'in-cash', 'in-mob', 'btn-submit', 'toast-btn'].forEach((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      POS[id] = { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
    });
  }

  // ------------------------------------------------------------------ the demo script (scene 3)
  const TYPE = 0.12;
  const DEMO = {
    navClose: 16.95,
    k: { click: 18.0, txt: '41', at: 18.15 },
    s: { click: 18.85, txt: '29', at: 19.0 },
    y: { click: 19.7, txt: '11', at: 19.85 },
    cash: { click: 20.95, txt: '98,000', at: 21.1 },
    mob: { click: 21.95, txt: '77,000', at: 22.1 },
    submit: 23.05,
    toastIn: 23.55,
    verify: 24.55,
    navHome: 25.35,
  };
  const typed = (d, t) => (t < d.at ? '' : d.txt.slice(0, clamp(Math.floor((t - d.at) / TYPE) + 1, 0, d.txt.length)));
  const doneAt = (d) => d.at + (d.txt.length - 1) * TYPE;

  // Cursor stops: [arrive time, target]. It leaves for the next stop `move` seconds before arriving.
  function cursorStops() {
    return [
      [15.0, { x: 1180, y: 880 }],
      [16.75, POS['nav-close']],
      [17.85, POS['in-k']],
      [18.7, POS['in-s']],
      [19.55, POS['in-y']],
      [20.8, POS['in-cash']],
      [21.8, POS['in-mob']],
      [22.9, POS['btn-submit']],
      [24.4, POS['toast-btn']],
      [25.2, POS['nav-home']],
      [26.4, { x: 700, y: 560 }],
    ];
  }
  const CLICKS = [DEMO.navClose, DEMO.k.click, DEMO.s.click, DEMO.y.click, DEMO.cash.click, DEMO.mob.click, DEMO.submit, DEMO.verify, DEMO.navHome];

  function cursorAt(t) {
    const S = cursorStops();
    if (t <= S[0][0]) return S[0][1];
    for (let i = 1; i < S.length; i++) {
      const [ta, pa] = S[i - 1], [tb, pb] = S[i];
      if (t <= tb) {
        const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
        const move = clamp(0.35 + dist / 1900, 0.4, 0.95);
        const start = Math.max(ta, tb - move);
        const p = seg(t, start, tb, E.inOut);
        // a gentle arc, the way a hand moves a mouse
        const nx = -(pb.y - pa.y) / (dist || 1), ny = (pb.x - pa.x) / (dist || 1);
        const arc = Math.sin(Math.PI * p) * dist * 0.06;
        return { x: lerp(pa.x, pb.x, p) + nx * arc, y: lerp(pa.y, pb.y, p) + ny * arc };
      }
    }
    return S[S.length - 1][1];
  }

  // ------------------------------------------------------------------ app content as a function of t
  function appState(t) {
    const verified = t >= DEMO.verify + 0.05;
    const onHomeAgain = t >= DEMO.navHome + 0.2;
    const page = t >= DEMO.navClose + 0.1 && t < DEMO.navHome + 0.1 ? 'close' : 'home';

    // --- home
    const after = seg(t, DEMO.navHome + 0.55, DEMO.navHome + 1.6, E.out);
    const intro = seg(t, 10.4, 11.9, E.out);
    text('h-sales', after > 0 ? fmt(175000 * after) : '—');
    text('h-profit', after > 0 ? fmt(46450 * after) : '—');
    text('h-cash', after > 0 ? fmt(175000 * after) : '—');
    text('h-stock', fmt(after > 0 ? lerp(486000, 311000, after) : 486000 * intro));
    text('h-low', onHomeAgain ? '11 left' : '18 left');
    const good = onHomeAgain;
    html('h-alert-ico', good ? ic('check', 16, 2.6) : ic('alert', 16));
    const ai = document.getElementById('h-alert-ico');
    ai.style.background = good ? 'var(--okSoft)' : 'var(--warnSoft)';
    ai.style.color = good ? 'var(--ok)' : 'var(--warn)';
    text('h-alert-t', good ? 'Tuesday closed and verified · TSh 175,000 · cash matches' : "Tuesday's stock hasn't been counted yet.");
    [62, 48, 70, 96, 88, 40].forEach((v, i) => { document.getElementById('bar-' + i).style.height = (v * intro + 2) + 'px'; });
    document.getElementById('bar-6').style.height = (lerp(14, 92, after) * intro + 2) + 'px';

    // --- close
    const vals = { k: typed(DEMO.k, t), s: typed(DEMO.s, t), y: typed(DEMO.y, t) };
    const AV = { k: [72, 3500], s: [36, 3500], y: [18, 6000] };
    let counted = 0, units = 0, sales = 0;
    ['k', 's', 'y'].forEach((k) => {
      const d = DEMO[k];
      const focus = t >= d.click && t < (k === 'y' ? DEMO.cash.click : DEMO[k === 'k' ? 's' : 'y'].click);
      const v = vals[k];
      const box = document.getElementById('in-' + k);
      box.className = 'inp' + (focus ? ' on' : v ? ' done' : '');
      html('in-' + k, (v || (focus ? '' : '—')) + (focus && Math.floor(t * 2.2) % 2 === 0 ? '<span class="caret"></span>' : ''));
      const full = t >= doneAt(d) + 0.12;
      if (full) {
        const sold = AV[k][0] - Number(d.txt);
        counted++; units += sold; sales += sold * AV[k][1];
        html('sold-' + k, `<span>Sold <em>${sold}</em></span><span>Sales <em>${fmt(sold * AV[k][1])}</em></span>`);
      } else html('sold-' + k, '');
      const sl = document.getElementById('sold-' + k);
      sl.style.opacity = full ? seg(t, doneAt(d) + 0.12, doneAt(d) + 0.4) : 0;
    });
    text('c-beer', `${(t >= doneAt(DEMO.k) + 0.12 ? 1 : 0) + (t >= doneAt(DEMO.s) + 0.12 ? 1 : 0)}/2`);
    text('c-spirit', `${t >= doneAt(DEMO.y) + 0.12 ? 1 : 0}/1`);
    text('c-counted', `${counted} / 3`);
    text('c-units', `${units} units sold`);
    text('c-exp', sales ? fmt(sales) : '—');
    ['cash', 'mob'].forEach((k) => {
      const d = DEMO[k];
      const focus = t >= d.click && t < (k === 'cash' ? DEMO.mob.click : DEMO.submit - 0.3);
      const v = typed(d, t);
      document.getElementById('in-' + k).className = 'inp' + (focus ? ' on' : v ? ' done' : '');
      html('in-' + k, (v ? v : focus ? '' : '0') + (focus && Math.floor(t * 2.2) % 2 === 0 ? '<span class="caret"></span>' : ''));
    });
    const moneyDone = t >= doneAt(DEMO.mob) + 0.15;
    const cashDone = t >= doneAt(DEMO.cash) + 0.15;
    const mt = document.getElementById('c-match-t');
    text(mt, moneyDone ? 'TSh 175,000 · matches' : cashDone ? 'TSh 98,000 of 175,000' : '—');
    mt.style.color = moneyDone ? 'var(--ok)' : 'var(--ink)';

    const submitted = t >= DEMO.submit + 0.08;
    const btn = document.getElementById('btn-submit');
    btn.style.background = submitted ? 'var(--ok)' : '';
    btn.style.boxShadow = submitted ? '0 14px 28px rgba(10,160,110,.3)' : '';
    btn.style.transform = `scale(${1 - 0.04 * (seg(t, DEMO.submit - 0.06, DEMO.submit, E.out) - seg(t, DEMO.submit, DEMO.submit + 0.2, E.out))})`;
    html('btn-submit-t', submitted ? `${ic('check', 18, 3)}&nbsp; Submitted for approval` : 'Submit closing');
    const pill = document.getElementById('c-pill');
    const st = verified ? ['Verified', 'ok'] : submitted ? ['Submitted', 'brand'] : ['Open', 'warn'];
    text(pill, '● ' + st[0]);
    pill.style.background = `var(--${st[1]}Soft)`; pill.style.color = `var(--${st[1]})`;

    // --- toast
    const toast = document.getElementById('toast');
    const tIn = seg(t, DEMO.toastIn, DEMO.toastIn + 0.5, E.outExpo);
    const tOut = seg(t, DEMO.navHome + 0.3, DEMO.navHome + 0.7);
    toast.style.opacity = tIn * (1 - tOut);
    toast.style.transform = `translateX(${(1 - tIn) * 60}px) scale(${0.97 + 0.03 * tIn})`;
    html('toast-ico', verified ? ic('check', 20, 2.6) : ic('bell', 20));
    const ti = document.getElementById('toast-ico');
    ti.style.background = verified ? 'var(--okSoft)' : 'var(--brandSoft)'; ti.style.color = verified ? 'var(--ok)' : 'var(--brand)';
    text('toast-t', verified ? 'Tuesday verified' : 'Joseph Mtei submitted Tuesday’s closing');
    text('toast-s', verified ? 'Counts locked · stock rolled over to Wednesday' : 'Sales TSh 175,000 · cash and mobile money match');
    const tb = document.getElementById('toast-btn');
    tb.style.display = 'inline-flex';
    tb.style.background = verified ? 'var(--okSoft)' : '';
    tb.style.color = verified ? 'var(--ok)' : '';
    html('toast-btn-t', verified ? `${ic('check', 13, 3)} Verified` : 'Verify');

    // --- pages
    const home = document.getElementById('pg-home'), close = document.getElementById('pg-close');
    const toClose = seg(t, DEMO.navClose + 0.05, DEMO.navClose + 0.45, E.out);
    const toHome = seg(t, DEMO.navHome + 0.05, DEMO.navHome + 0.45, E.out);
    const homeO = page === 'home' ? (t > DEMO.navHome ? toHome : 1 - toClose) : 0;
    const closeO = page === 'close' ? toClose : t >= DEMO.navHome ? 1 - toHome : 0;
    home.style.opacity = homeO; home.style.transform = `translateY(${(1 - homeO) * 14}px)`;
    close.style.opacity = closeO; close.style.transform = `translateY(${(1 - closeO) * 14}px)`;
    home.style.visibility = homeO < 0.01 ? 'hidden' : 'visible';
    close.style.visibility = closeO < 0.01 ? 'hidden' : 'visible';
    document.getElementById('nav-home').className = 'side-i' + (page === 'home' ? ' on' : '');
    document.getElementById('nav-close').className = 'side-i' + (page === 'close' ? ' on' : '');
  }

  /** Where the product window sits: app point (cx,cy) shown at screen (x,y), scaled s. */
  // The product is laid out at 1440×810 and shown 4/3 larger, so its type
  // reads like a screen recording on a big display rather than a tiny UI.
  const AW = 1440, AH = 810, FULL = W / AW;
  function setApp({ s = 1, cx = AW / 2, cy = AH / 2, x = CX, y = CY, o = 1, radius = 0, dim = 0, fill = false }) {
    if (fill) {
      // never let a zoomed shot show past the edge of the app
      const hw = AW / 2 / s, hh = AH / 2 / s;
      cx = clamp(cx, hw, AW - hw); cy = clamp(cy, hh, AH - hh);
    }
    const sc = s * FULL;
    appWrap.style.transform = `translate(${x - cx * sc}px,${y - cy * sc}px) scale(${sc})`;
    appWrap.style.opacity = o;
    appWrap.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
    appWrap.style.borderRadius = (radius / Math.max(sc, 0.02)) + 'px';
    appWrap.style.boxShadow = radius > 0.5 ? `0 ${40 / sc}px ${120 / sc}px rgba(0,0,0,.55), 0 0 0 ${1 / sc}px rgba(255,255,255,.08)` : 'none';
    appDim.style.opacity = dim;
  }
  /** Camera keyframes: hold between equal keys, glide between different ones. */
  function cam(keys, t) {
    if (t <= keys[0].t) return keys[0];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i].t) {
        const a = keys[i - 1], b = keys[i], p = seg(t, a.t, b.t, E.inOut);
        return { s: lerp(a.s, b.s, p), cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p) };
      }
    }
    return keys[keys.length - 1];
  }
  const DEMO_CAM = [
    { t: 15.0, s: 1, cx: 720, cy: 405 },
    { t: 17.25, s: 1, cx: 720, cy: 405 },
    { t: 17.9, s: 1.28, cx: 600, cy: 300 },
    { t: 20.35, s: 1.28, cx: 600, cy: 300 },
    { t: 20.95, s: 1.25, cx: 1160, cy: 330 },
    { t: 23.2, s: 1.25, cx: 1160, cy: 330 },
    { t: 23.8, s: 1.1, cx: 1000, cy: 330 },
    { t: 25.2, s: 1.1, cx: 1000, cy: 330 },
    { t: 25.75, s: 1, cx: 720, cy: 405 },
    { t: 27.0, s: 1.05, cx: 720, cy: 390 },
  ];

  function bez(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return { x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x, y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y };
  }
  function curve(a, b, vertical) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const c1 = vertical ? { x: a.x, y: a.y + dy * 0.55 } : { x: a.x + dx * 0.55, y: a.y };
    const c2 = vertical ? { x: b.x, y: b.y - dy * 0.55 } : { x: b.x - dx * 0.55, y: b.y };
    return [a, c1, c2, b];
  }
  const dstr = (c) => `M${c[0].x},${c[0].y} C${c[1].x},${c[1].y} ${c[2].x},${c[2].y} ${c[3].x},${c[3].y}`;

  // ------------------------------------------------------------------ scene 1 element positions
  const FREEZE = 7.0;
  function chipPos(c, t) {
    const m = Math.max(0, Math.min(t, FREEZE) - c.a);
    const fl = Math.min(t, FREEZE);
    return { x: c.x + c.vx * m + Math.sin(fl * 0.9 + c.ph) * 6, y: c.y + c.vy * m + Math.cos(fl * 0.7 + c.ph) * 5 };
  }
  function winPos(w, t) {
    const m = Math.max(0, Math.min(t, FREEZE) - w.a);
    return { x: w.x + w.vx * m, y: w.y + w.vy * m, r: w.r0 + w.vr * m };
  }
  const S1CAM = (t) => 1 + 0.045 * seg(Math.min(t, FREEZE), 0, FREEZE, E.sine);
  /** Scene-1 camera applied to a point, so dots leave from where the eye saw the window. */
  function viaCam(p, t) { const s = t < 9 ? S1CAM(t) : S1CAM(9); return { x: CX + (p.x - CX) * s, y: CY + (p.y - CY) * s }; }

  // dots for scene 2: sources are the six windows and the first six chips
  const DOT_SRC = [];
  WINS.forEach((w, i) => DOT_SRC.push({ kind: 'w', ref: w, start: 8.35 + i * 0.1 }));
  chips.slice(0, 6).forEach((c, i) => DOT_SRC.push({ kind: 'c', ref: c, start: 8.15 + i * 0.07 }));

  // ------------------------------------------------------------------ renderAt
  function renderAt(t) {
    t = ((t % DUR) + DUR) % DUR;
    appState(t);

    // ===== scene 1 — fragments (0–8, exits through 9.5)
    s1cam.style.transform = `scale(${S1CAM(t)})`;
    // focus pulls off the clutter while the line of type has the frame
    { const f = Math.min(seg(t, 4.9, 5.5), 1 - seg(t, 7.6, 8.1)); s1cam.style.filter = f > 0.01 ? `blur(${(f * 5).toFixed(2)}px)` : 'none'; }
    chips.forEach((c, i) => {
      const p = chipPos(c, t);
      const inP = seg(t, c.a, c.a + 0.55, E.outBack);
      const fade = c.z < 0.8 ? 0.5 : 0.92;
      const exitA = 8.0 + i * 0.035;
      const ex = seg(t, exitA, exitA + 0.55, E.in);
      const x = lerp(p.x, CX, ex * 0.25), y = lerp(p.y, CY, ex * 0.25);
      place(c.e, { x, y, s: c.z * lerp(i === 0 ? 0.25 : 0.7, 1, inP) * (1 - ex * 0.75), o: fade * clamp(inP * 1.4) * (1 - ex), blur: c.z < 0.8 ? (0.8 - c.z) * 6 : 0 });
    });
    WINS.forEach((w, i) => {
      const p = winPos(w, t);
      const inP = seg(t, w.a, w.a + 0.45, E.outExpo);
      const exitA = 8.05 + i * 0.1;
      const ex = seg(t, exitA, exitA + 0.6, E.in);
      place(w.e, { x: lerp(p.x, CX, ex * 0.2), y: lerp(p.y, CY, ex * 0.2), s: lerp(0.9, 1, inP) * (1 - ex * 0.97), r: p.r, o: inP * (1 - seg(t, exitA + 0.35, exitA + 0.6)) });
    });
    {
      const inP = seg(t, 4.4, 4.85, E.outExpo);
      const m = Math.max(0, Math.min(t, FREEZE) - 4.4);
      const ex = seg(t, 8.0, 8.4, E.in);
      place(notif, { x: 1500 - (1 - inP) * -60 + m * 4, y: 150 + m * 2, s: 1 - ex * 0.6, o: inP * (1 - ex) });
    }
    show(scrim, 0.62 * Math.min(seg(t, 4.85, 5.4), 1 - seg(t, 7.6, 8.15)));
    words(t1, t, 5.05, 0.11, 7.55, 0.4);

    // the loop point: the end of the film and the start of it
    {
      let dp = null;
      if (t < 0.7) dp = { x: P.x, y: P.y, s: 1 - seg(t, 0.12, 0.65) * 0.6, o: 1 - seg(t, 0.25, 0.7) };
      if (t >= 70.2) {
        const born = seg(t, 70.2, 71.1, E.out);
        const go = seg(t, 71.1, 74.6, E.inOut);
        const a = { x: CX, y: CY }, b = P;
        const c = bez(a, { x: CX - 200, y: CY - 160 }, { x: P.x + 260, y: P.y - 120 }, b, go);
        dp = { x: c.x, y: c.y, s: lerp(1.9, 1, born) * (1 + 0.15 * Math.sin(Math.PI * go)), o: born };
      }
      if (dp) place(mainDot, dp); else show(mainDot, 0);
    }

    // ===== scene 2 — collapse into one (8–15)
    DOT_SRC.forEach((d, j) => {
      const e = DOTS[j];
      if (t < d.start || t > d.start + 1.4) { show(e, 0); return; }
      const srcT = d.start;
      const raw = d.kind === 'w' ? winPos(d.ref, srcT) : chipPos(d.ref, srcT);
      const from = viaCam({ x: lerp(raw.x, CX, 0.2), y: lerp(raw.y, CY, 0.2) }, srcT);
      const p = seg(t, d.start, d.start + 1.25, E.inOut);
      const side = j % 2 ? 1 : -1;
      const mid = { x: (from.x + CX) / 2 - (from.y - CY) * 0.25 * side, y: (from.y + CY) / 2 + (from.x - CX) * 0.25 * side };
      const c = bez(from, mid, mid, { x: CX, y: CY }, p);
      place(e, { x: c.x, y: c.y, s: 1 - p * 0.3, o: Math.min(seg(t, d.start, d.start + 0.12), 1 - seg(t, d.start + 1.1, d.start + 1.28)) });
    });
    // glow gathers where the dots land, then hands over to the product
    {
      const g = Math.max(
        seg(t, 8.8, 10.0) * (1 - seg(t, 10.2, 11.4)),
        0.55 * seg(t, 59.4, 60.4) * (1 - seg(t, 66.2, 67.4)),
      );
      place(glow, { x: CX, y: t > 50 ? 430 : CY, s: t > 50 ? 1.1 : 0.55 + 0.35 * seg(t, 8.8, 10.2), o: g });
    }

    // ===== the product window across scenes
    if (t >= 10.1 && t < 15) {
      const grow = seg(t, 10.1, 11.3, E.outExpo);
      const push = seg(t, 11.3, 14.05, E.sine);
      const full = seg(t, 14.05, 15.0, E.inOut);
      const s = lerp(lerp(0.04, 0.5, grow) + push * 0.04, 1, full);
      setApp({ s, x: CX, y: lerp(470, CY, full), o: seg(t, 10.1, 10.35), radius: 22 * (1 - full) });
    } else if (t >= 15 && t < 27) {
      const c = cam(DEMO_CAM, t);
      setApp({ s: c.s, cx: c.cx, cy: c.cy, fill: true });
    } else if (t >= 27 && t < 40.4) {
      const pull = seg(t, 27.0, 28.25, E.inOut);
      const s0 = 1.05;
      const s = lerp(s0, 0.36, pull);
      // dim the core while a module has the stage
      let focus = 0;
      MODS.forEach((m, i) => { const T = 28.0 + 1.75 * i; focus = Math.max(focus, Math.min(seg(t, T, T + 0.4), 1 - seg(t, T + 1.2, T + 1.7))); });
      const end = seg(t, 39.4, 40.3, E.inOut);
      setApp({ s: lerp(s, 0.06, end) * (1 + 0.06 * seg(t, 36.8, 39.2, E.sine) * (1 - end)), cy: lerp(390, 405, pull), x: lerp(CX, 260, end), y: lerp(CY, 470, end), o: 1 - seg(t, 40.0, 40.35), radius: 18 * pull, dim: focus * 0.55 });
    } else if (t >= 49.6 && t < 60.6) {
      const inP = seg(t, 49.6, 50.9, E.outExpo);
      const coll = seg(t, 56.3, 57.6, E.inOut);
      const out = seg(t, 59.3, 60.4, E.inOut);
      const camS = lerp(1.12, 0.96, seg(t, 50.0, 55.5, E.sine));
      const s = lerp(lerp(0.06, 0.27, inP) * camS, 0.46, coll) * (1 + 0.04 * out);
      setApp({ s, x: CX, y: lerp(CY, 470, coll), o: inP * (1 - out), radius: 18 });
    } else if (t >= 66.4 && t < 71.3) {
      const inP = seg(t, 66.4, 67.6, E.out);
      const zoom = seg(t, 67.9, 70.7, E.inOut);
      const s = lerp(lerp(0.4, 0.46, inP), 0.02, zoom);
      setApp({ s, x: CX, y: CY, o: inP * (1 - seg(t, 70.3, 70.9)), radius: lerp(18, 60, zoom) });
    } else setApp({ o: 0 });

    // cursor and its clicks live in product coordinates
    {
      const on = t >= 15.2 && t < 26.9;
      const c = cursorAt(t);
      let press = 0, rp = -1;
      CLICKS.forEach((ct) => {
        press = Math.max(press, Math.min(seg(t, ct - 0.06, ct, E.out), 1 - seg(t, ct, ct + 0.14, E.out)));
        if (t >= ct && t < ct + 0.45) rp = (t - ct) / 0.45;
      });
      cursor.style.transform = `translate(${c.x - 5}px,${c.y - 3}px) scale(${1 - press * 0.12})`;
      cursor.style.opacity = on ? Math.min(seg(t, 15.2, 15.5), 1 - seg(t, 26.5, 26.9)) : 0;
      ripple.style.opacity = rp >= 0 && on ? (1 - rp) * 0.9 : 0;
      ripple.style.transform = `translate(${c.x}px,${c.y}px) scale(${0.35 + rp * 1.1})`;
    }

    // ===== scene 2 & 4 & 6 type
    words(t2a, t, 11.45, 0.12, 12.65, 0.35);
    words(t2b, t, 13.0, 0.12, 14.1, 0.35);

    // ===== scene 4 — modules (27–40)
    MODS.forEach((m, i) => {
      const T = 28.0 + 1.75 * i;
      const slot = { x: CX + m.slot[0], y: CY + m.slot[1] };
      const inP = seg(t, T, T + 0.5, E.outExpo);
      const dock = seg(t, T + 1.25, T + 1.8, E.inOut);
      const end = seg(t, 39.3, 40.0, E.inOut);
      const focusPos = { x: CX, y: 520 };
      const x = lerp(lerp(focusPos.x + 560, focusPos.x, inP), slot.x, dock);
      const y = lerp(focusPos.y, slot.y, dock);
      const s = lerp(1.18, 0.4, dock) * (1 - end * 0.6);
      const ex = { x: lerp(x, 260, end), y: lerp(y, 470, end) };
      place(m.e, { x: ex.x, y: ex.y, s, o: t < T ? 0 : Math.min(seg(t, T, T + 0.3), 1 - end) });
      place(m.lab, { x: slot.x, y: slot.y + (i === 4 ? -118 : 118), s: 1, o: dock * (1 - end) * 0.9 });
      const draw = seg(t, T + 1.55, T + 2.1, E.inOut) * (1 - end);
      const core = { x: CX, y: CY };
      const cv = curve(slot, core, i === 4);
      m.path.setAttribute('d', dstr(cv));
      m.path.setAttribute('stroke-dashoffset', 1 - draw);
      m.path.style.opacity = draw > 0 ? 1 : 0;
      m.flow.forEach((f, k) => {
        const phase = ((t - (T + 2.1)) * 0.55 + k / 3) % 1;
        const live = t > T + 2.1 && t < 39.6;
        const pt = bez(cv[0], cv[1], cv[2], cv[3], phase);
        place(f, { x: pt.x, y: pt.y, s: 0.8, o: live ? Math.sin(Math.PI * phase) * (1 - end) : 0 });
      });
    });
    words(t4, t, 37.0, 0.08, 39.2, 0.4);

    // ===== scene 5 — workflow (40–50)
    {
      const inP = seg(t, 40.0, 40.7, E.outExpo);
      const out = seg(t, 49.2, 50.2, E.inOut);
      const pan = seg(t, 40.7, 48.0, E.sine);
      const stripX = lerp(CX - WF[0].x - 290, CX - WF[6].x + 290, pan);
      const sc = lerp(1.12, 1.22, inP) * lerp(1, 0.5, out);
      const y = 500;
      const xs = (x) => CX + (stripX + x - CX) * sc;
      WF.forEach((w, i) => {
        const A = 40.9 + i * 1.0;
        const on = seg(t, A, A + 0.3, E.out);
        const pop = Math.sin(Math.PI * seg(t, A, A + 0.45)) * 0.05;
        place(w.e, { x: xs(w.x), y: lerp(y + 40, y, inP), s: sc * (1 + pop), o: (0.35 + 0.65 * Math.max(on, 0.35)) * inP * (1 - out) });
        w.on.style.opacity = on;
      });
      WF_LINKS.forEach((lk, i) => {
        const A = 40.9 + i * 1.0;
        place(lk, { x: xs(WF[i].x + 185), y, s: sc, o: inP * (1 - out) });
        lk.firstElementChild.style.width = (seg(t, A + 0.4, A + 0.95, E.inOut) * 100) + '%';
      });
      // the token rides above the strip and changes as the work moves on
      const step = clamp(Math.floor((t - 40.9) / 1.0), 0, 6);
      const A = 40.9 + step * 1.0;
      const hop = step < 6 ? seg(t, A + 0.45, A + 1.0, E.inOut) : 0;
      const tx = lerp(WF[step].x, WF[Math.min(step + 1, 6)].x, hop);
      text(token, TOKENS[hop > 0.5 ? Math.min(step + 1, 6) : step]);
      place(token, { x: xs(tx), y: y - 170 * sc - Math.sin(Math.PI * hop) * 26, s: sc, o: seg(t, 40.9, 41.2) * (1 - out) });
      words(t5a, t, 47.1, 0.1, 48.15, 0.3);
      words(t5b, t, 48.4, 0.12, 49.3, 0.4);
    }

    // ===== scene 6 — the big picture (50–60)
    {
      const camS = lerp(1.12, 0.96, seg(t, 50.0, 55.5, E.sine));
      const coll = seg(t, 56.3, 57.5, E.in);
      const core = { x: CX, y: lerp(CY, 470, seg(t, 56.3, 57.6, E.inOut)) };
      TILES.forEach((tl, k) => {
        const appear = seg(t, 50.3 + k * 0.16, 51.2 + k * 0.16, E.outExpo);
        const ang = tl.a0 + (t - 50) * (tl.near ? 0.065 : 0.05);
        const rx = (tl.near ? 760 : 600) * camS, ry = (tl.near ? 375 : 300) * camS;
        const par = Math.sin((t - 50) * 0.5) * (tl.near ? 18 : -10);
        let x = CX + Math.cos(ang) * rx * appear + par;
        let y = CY + Math.sin(ang) * ry * appear;
        x = lerp(x, core.x, coll); y = lerp(y, core.y, coll);
        const s = (tl.near ? 0.95 : 0.72) * camS * lerp(0.3, 1, appear) * (1 - coll * 0.85);
        const live = t > 50.2 && t < 57.6;
        place(tl.e, { x, y, s, o: live ? appear * (1 - seg(t, 57.0, 57.5)) * (tl.near ? 1 : 0.92) : 0, blur: tl.near ? 0 : 0.8 });
        const draw = seg(t, 51.0 + k * 0.12, 51.8 + k * 0.12, E.inOut) * (1 - seg(t, 56.2, 56.9));
        const cv = curve({ x, y }, core, false);
        tl.path.setAttribute('d', dstr(cv));
        tl.path.setAttribute('stroke-dashoffset', 1 - draw);
        tl.path.style.opacity = live && draw > 0 ? (tl.near ? 1 : 0.6) : 0;
        const ph = ((t - 51) * 0.5 + k / 8) % 1;
        const pt = bez(cv[0], cv[1], cv[2], cv[3], ph);
        place(tl.flow, { x: pt.x, y: pt.y, s: 0.75, o: live && t > 51.8 ? Math.sin(Math.PI * ph) * draw : 0 });
      });
      words(t6a, t, 57.5, 0.12, 59.25, 0.45);
      words(t6b, t, 58.2, 0.12, 59.25, 0.45);
    }

    // ===== scene 7 — brand (60–67)
    {
      const out = seg(t, 66.0, 66.9, E.inOut);
      const m = seg(t, 60.35, 61.6, E.outExpo);
      const settle = 1 + 0.012 * Math.sin(Math.PI * seg(t, 61.0, 62.2));
      place(markTile, { x: CX, y: 360, s: lerp(0.9, 1, m) * settle * (1 - out * 0.05), o: m * (1 - out) });
      words(t7a, t, 61.25, 0.1, 66.0, 0.6);
      const w = seg(t, 62.7, 63.5, E.outExpo);
      place(t7b, { x: CX, y: 752 - (1 - w) * 18, o: w * (1 - out) });
      const b = seg(t, 63.5, 64.3, E.outExpo);
      place(t7c, { x: CX, y: 836 - (1 - b) * 14, o: b * (1 - out) });
    }
  }

  // ------------------------------------------------------------------ sound cues
  const EVENTS = [];
  const ev = (t, type, gain = 1) => EVENTS.push({ t: +t.toFixed(3), type, gain });
  chips.forEach((c, i) => ev(c.a + 0.05, 'pop', i === 0 ? 0.8 : 0.35 + 0.25 * c.z));
  WINS.forEach((w) => ev(w.a, 'open', 0.7));
  ev(4.4, 'notify', 0.5);
  ev(5.05, 'swell', 0.6);
  ev(7.0, 'freeze', 0.9);
  ev(8.0, 'whoosh', 0.9);
  DOT_SRC.forEach((d) => ev(d.start + 1.2, 'blip', 0.25));
  ev(10.1, 'impact', 1);
  ev(14.05, 'whoosh', 0.6);
  CLICKS.forEach((c) => ev(c, 'click', 0.9));
  ['k', 's', 'y', 'cash', 'mob'].forEach((k) => { const d = DEMO[k]; for (let i = 0; i < d.txt.length; i++) if (d.txt[i] !== ',') ev(d.at + i * TYPE, 'key', 0.6); });
  ev(DEMO.navClose + 0.05, 'swipe', 0.5);
  ev(DEMO.submit + 0.08, 'confirm', 0.9);
  ev(DEMO.toastIn, 'notify', 0.9);
  ev(DEMO.verify + 0.05, 'confirm', 1);
  ev(DEMO.navHome + 0.05, 'swipe', 0.5);
  ev(DEMO.navHome + 0.55, 'count', 0.7);
  ev(27.0, 'whoosh', 0.7);
  MODS.forEach((m, i) => { const T = 28.0 + 1.75 * i; ev(T, 'whoosh', 0.55); ev(T + 1.3, 'dock', 0.6); ev(T + 1.6, 'blip', 0.4); });
  ev(39.4, 'whoosh', 0.8);
  WF.forEach((w, i) => ev(40.9 + i, 'step', 0.75));
  ev(49.3, 'whoosh', 0.8);
  ev(50.0, 'impact', 0.9);
  TILES.forEach((tl, k) => ev(50.3 + k * 0.16, 'pop', 0.45));
  ev(56.3, 'reverse', 0.9);
  ev(57.5, 'impact', 0.7);
  ev(59.4, 'whoosh', 0.5);
  ev(60.35, 'logo', 1);
  ev(66.0, 'whoosh', 0.4);
  ev(67.9, 'reverse', 0.6);
  ev(70.4, 'blip', 0.6);
  EVENTS.sort((a, b) => a.t - b.t);

  // ------------------------------------------------------------------ boot
  window.DUR = DUR;
  window.EVENTS = EVENTS;
  window.renderAt = renderAt;
  window.ready = document.fonts.ready.then(() => {
    // the brand image has to be decoded before frame capture starts
    const img = markTile.querySelector('img');
    return img.decode ? img.decode().catch(() => {}) : null;
  }).then(() => {
    // lay both pages out for measuring, then hand control to the timeline
    document.getElementById('toast').style.opacity = 0;
    measure();
    renderAt(0);
    return true;
  });

  // Opened in a browser with ?play, the film plays in real time (for review).
  if (/[?&]play/.test(location.search)) {
    window.ready.then(() => {
      const t0 = performance.now();
      const loop = () => { renderAt(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(loop); };
      loop();
    });
  }
  const m = /[?&]t=([\d.]+)/.exec(location.search);
  if (m) window.ready.then(() => renderAt(parseFloat(m[1])));
})();
