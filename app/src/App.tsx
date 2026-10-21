import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';
import { DataProvider, useData } from './state/DataContext';
import { SalonProvider } from './state/SalonContext';
import { ToastProvider } from './state/ToastContext';
import { IconSprite } from './lib/icons';
import { BottomNav } from './components/BottomNav';
import { InstallPrompt } from './components/InstallPrompt';
import { Sidebar } from './components/Sidebar';
import { AuthScreen } from './routes/AuthScreen';
import { Home } from './routes/Home';
import { StaffHome } from './routes/StaffHome';
import { Stock } from './routes/Stock';
import { Close } from './routes/Close';
import { Difference } from './routes/Difference';
import { NativeShell } from './components/NativeShell';
import { checkPlatformAdmin } from './lib/platform';
import { BOOT_CEILING_MS } from './lib/boot';
import { Icon } from './lib/icons';
import { StaffSignIn } from './components/StaffAccess';
import { loadScreen, preloadAll } from './lib/routeChunks';
import { ScreenBoundary } from './components/ScreenBoundary';
import { ScrollManager } from './components/ScrollManager';
import { clockSkewMs, jwtTrouble, loadErrorKind } from './lib/supabase';

/*
  What loads first, and what waits.

  Home, Stock, Close and Difference are the app: a bar opens it to count and to
  see the day. Everything else — the whole control panel above all, which no
  tenant will ever open — is fetched when someone actually asks for it. On a
  phone on a Tanzanian mobile network that difference is the difference between
  the app opening and the app appearing to be broken.
*/
const Onboarding = lazy(() => loadScreen('onboarding').then((m) => ({ default: m.Onboarding })));
const Approval = lazy(() => loadScreen('approval').then((m) => ({ default: m.Approval })));
const Money = lazy(() => loadScreen('money').then((m) => ({ default: m.Money })));
const Reports = lazy(() => loadScreen('reports').then((m) => ({ default: m.Reports })));
const AI = lazy(() => loadScreen('ai').then((m) => ({ default: m.AI })));
const Manage = lazy(() => loadScreen('manage').then((m) => ({ default: m.Manage })));
const BusinessProfile = lazy(() => loadScreen('business').then((m) => ({ default: m.BusinessProfile })));
const Staff = lazy(() => loadScreen('staff').then((m) => ({ default: m.Staff })));
const Hq = lazy(() => loadScreen('hq').then((m) => ({ default: m.Hq })));
const Suspended = lazy(() => loadScreen('suspended').then((m) => ({ default: m.Suspended })));
const Pricing = lazy(() => loadScreen('pricing').then((m) => ({ default: m.Pricing })));
const Help = lazy(() => loadScreen('help').then((m) => ({ default: m.Help })));
const Legal = lazy(() => loadScreen('legal').then((m) => ({ default: m.Legal })));
const SetPassword = lazy(() => loadScreen('setPassword').then((m) => ({ default: m.SetPassword })));
const Book = lazy(() => loadScreen('book').then((m) => ({ default: m.Book })));
const Ticket = lazy(() => loadScreen('ticket').then((m) => ({ default: m.Ticket })));
const Receipt = lazy(() => loadScreen('receipt').then((m) => ({ default: m.Receipt })));
const SalonToday = lazy(() => loadScreen('salonToday').then((m) => ({ default: m.SalonToday })));
const Bookings = lazy(() => loadScreen('bookings').then((m) => ({ default: m.Bookings })));
const Clients = lazy(() => loadScreen('clients').then((m) => ({ default: m.Clients })));
const Services = lazy(() => loadScreen('services').then((m) => ({ default: m.Services })));
const Payouts = lazy(() => loadScreen('payouts').then((m) => ({ default: m.Payouts })));
const SalonReports = lazy(() => loadScreen('salonReports').then((m) => ({ default: m.SalonReports })));
const ShopHome = lazy(() => loadScreen('shopHome').then((m) => ({ default: m.ShopHome })));
const ShopProducts = lazy(() => loadScreen('shopProducts').then((m) => ({ default: m.Products })));
const ShopPage = lazy(() => loadScreen('shopPage').then((m) => ({ default: m.ShopPage })));

/*
  bermione.com/<name> is a shop's or a barbershop's public page. Any single
  path segment the app does not use itself is treated as one; the database
  refuses these words as shop names (slug_reserved) so the two never meet.
*/
const APP_PATHS = new Set(['home', 'stock', 'close', 'money', 'reports', 'manage', 'pricing', 'help', 'legal', 'hq', 'book', 'q', 'r', 's',
  'ai', 'staff', 'business', 'approval', 'diff', 'bookings', 'clients', 'services', 'payouts', 'products', 'shop', 'login', 'signup',
  'set-password', 'api', 'assets', 'icons', 'admin', 'www', 'app', 'support', 'about', 'terms', 'privacy', 'index', 'sw', 'manifest']);
function publicSlug(path: string): string | null {
  const m = /^\/([a-z0-9-]{2,60})\/?$/i.exec(path);
  return m && !APP_PATHS.has(m[1].toLowerCase()) ? m[1] : null;
}

/**
 * What fills the gap while a screen is fetched.
 *
 * Rarely seen now — every screen is preloaded in the background once the app
 * is up — but when it is (a cold cache on a slow network), it looks like the
 * app laying out the page, in the theme's colours, never an empty void.
 */
function Pending() {
  return (
    <div className="screen" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 38, width: '55%', borderRadius: 12, marginTop: 6 }} />
      <div className="skeleton" style={{ height: 16, width: '35%', borderRadius: 8, marginTop: 10 }} />
      <div className="skeleton" style={{ height: 120, marginTop: 22 }} />
      <div className="skeleton" style={{ height: 76, marginTop: 12 }} />
      <div className="skeleton" style={{ height: 76, marginTop: 12 }} />
    </div>
  );
}

function ThemeRoot() {
  const { profile } = useData();
  // Until the profile arrives, keep whatever the device remembered.
  const theme = profile ? profile.theme || 'light' : null;
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    // Remembered on the device, so the next open paints in the right theme
    // from the very first frame instead of flashing light then dark.
    try { localStorage.setItem('bermi:theme', theme); } catch { /* private mode */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0c16' : '#f5f7fc');
  }, [theme]);
  return null;
}

/**
 * Hand the screen over from the boot splash painted by index.html.
 *
 * Called once, at the point the app is actually usable. Until then the splash
 * stays up — which is the difference between one load and what used to look
 * like two, a splash dissolving into a bare "Loading…" line.
 */
function handOverFromSplash() {
  window.__bermiReady?.();
  window.__bermiReady = undefined;
}

/**
 * What is underneath the splash when the start goes wrong.
 *
 * The waiting branch used to render null, on the reasoning that the boot screen
 * was covering it. It is, for four and a half seconds — and then it is not, and
 * null is a blank white page with nothing to act on and nothing to report. One
 * dropped request was enough to get here.
 */
function StillStarting({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  // The profile — and with it the language setting — is exactly what failed to
  // load, so the phone's own language decides.
  const sw = typeof navigator !== 'undefined' && /^sw/i.test(navigator.language || '');
  // Still waiting, but the requests underneath are being refused for token
  // time: that is the server, not the connection, and it should say so.
  const [refused, setRefused] = useState(jwtTrouble());
  useEffect(() => {
    if (error) return;
    const t = setInterval(() => setRefused(jwtTrouble()), 1000);
    return () => clearInterval(t);
  }, [error]);
  const kind = error ? loadErrorKind(error) : refused ? 'auth-time' : null;
  const skew = clockSkewMs();
  const clockWrong = skew !== null && Math.abs(skew) > 5 * 60_000;

  // A sign-in the server has not caught up with clears by itself: ask again
  // without making anyone press anything.
  useEffect(() => {
    if (!error || kind !== 'auth-time') return;
    const t = setTimeout(onRetry, 10_000);
    return () => clearTimeout(t);
  }, [kind, error, onRetry]);

  const title = kind === 'auth-time'
    ? (sw ? 'Inathibitisha kuingia kwako…' : 'Confirming your sign-in…')
    : !error
      ? (sw ? 'Bado inafunguka…' : 'Still opening…')
      : (sw ? 'Bermi One imeshindwa kufunguka' : 'Bermi One could not load');
  const body = kind === 'auth-time'
    ? (sw ? 'Seva ya Supabase haikubali kuingia kwa sasa. Data yako iko salama — Bermi inaendelea kujaribu na itafunguka yenyewe.' : 'The Supabase server is not accepting sign-ins right now. Your data is safe — Bermi keeps trying and will open on its own.')
    : !error
      ? (sw ? 'Inachukua muda kuliko kawaida. Mtandao wako unaweza kuwa wa polepole.' : 'This is taking longer than it should. Your connection may be slow.')
      : kind === 'network'
        ? (sw ? 'Imeshindwa kufikia seva. Angalia mtandao kisha ujaribu tena. Hakuna kilichopotea.' : 'The app could not reach the server. Check your connection and try again. Nothing you have recorded is lost.')
        : (sw ? 'Hakuna ulichorekodi kilichopotea — ni programu imeshindwa kufikia seva.' : 'Nothing you have recorded is lost — this is the app failing to reach the server.');

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <img src="/icons/bermi-mark.svg" alt="" width={64} height={64} style={{ marginBottom: 18 }} />
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.3 }}>{title}</div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6 }}>{body}</div>
        {clockWrong && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--warnSoft)', color: 'var(--warn)', fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
            {sw
              ? 'Tarehe au saa ya simu yako inaonekana si sahihi. Washa "saa ya kiotomatiki" kwenye mipangilio.'
              : 'Your phone\'s date or time looks wrong. Turn on automatic date & time in Settings.'}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink3)', fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.5 }}>
            {sw ? 'Maelezo' : 'Details'}: {error}
          </div>
        )}
        <button
          className="btn-primary tap"
          style={{ width: '100%', marginTop: 18, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={onRetry}
        >
          <Icon name="refresh" size={15} />
          {sw ? 'Jaribu tena' : 'Try again'}
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { session, loading: authLoading, recovering } = useAuth();
  const { ready, loadError, reload, profile, activeBusiness, role, activeStaff } = useData();
  const location = useLocation();
  const owner = role === 'owner';

  /*
    True once the splash has had its turn.

    Same ceiling main.tsx uses to take the boot screen away, so the two cannot
    drift: the moment the cover comes off, whatever is underneath has to be a
    screen someone can read and act on.
  */
  const [booted, setBooted] = useState(false);
  const isSalonBiz = useData().activeBusiness?.type === 'barber';
  // Once the app is up, fetch every screen's code in idle time so moving
  // between pages never waits on the network.
  useEffect(() => {
    if (!session || !ready) return;
    const t = setTimeout(() => preloadAll(isSalonBiz), 400);
    return () => clearTimeout(t);
  }, [session, ready, isSalonBiz]);
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), BOOT_CEILING_MS);
    return () => clearTimeout(t);
  }, []);

  // Bermi Techs staff. This only decides what the interface offers — the admin
  // function re-checks it server side, and RLS decides what the data allows.
  const [isStaff, setIsStaff] = useState(false);
  useEffect(() => {
    if (!session) { setIsStaff(false); return; }
    void checkPlatformAdmin().then(setIsStaff);
  }, [session]);

  /*
    The legal pages come before everything, including the loading spinner.

    A store reviewer opens the privacy URL with no account and no patience, and
    someone who has just deleted their account still has to be able to read what
    happened to their data. Neither has a session, so neither can be behind one.
  */
  if (location.pathname.startsWith('/legal')) {
    handOverFromSplash();
    return <Suspense fallback={<Pending />}><Legal /></Suspense>;
  }

  // A barbershop's public booking page: for its clients, who have no account.
  // A subscription receipt from the payment SMS: opened by the client, often signed out.
  if (publicSlug(location.pathname)) {
    handOverFromSplash();
    return <Suspense fallback={<Pending />}><Routes><Route path="/:slug" element={<ShopPage />} /></Routes></Suspense>;
  }

  if (location.pathname.startsWith('/book/') || location.pathname.startsWith('/q/') || location.pathname.startsWith('/r/')) {
    handOverFromSplash();
    return <Suspense fallback={<Pending />}><Routes><Route path="/book/:slug" element={<Book />} /><Route path="/q/:token" element={<Ticket />} /><Route path="/r/:token" element={<Receipt />} /></Routes></Suspense>;
  }

  /*
    Still starting up. While the splash is still on the glass there is nothing
    to show that it is not showing better, so this renders nothing — but only
    until the splash's own ceiling. After that something real has to be here.
  */
  if (authLoading || (session && !ready)) {
    if (!booted) return null;
    handOverFromSplash();
    return <StillStarting error={loadError} onRetry={() => { reload(); setBooted(false); }} />;
  }

  handOverFromSplash();

  // Loaded, but the load failed — an empty app would look like an empty
  // business, which is a far worse lie than an error message.
  if (session && loadError) {
    return <StillStarting error={loadError} onRetry={reload} />;
  }

  if (!session) return <AuthScreen />;

  // A recovery link signs someone in without them knowing their password. This
  // stands in front of everything until they have chosen one.
  if (recovering) return <Suspense fallback={<Pending />}><SetPassword /></Suspense>;

  if (!profile?.onboarded) return <Suspense fallback={<Pending />}><Onboarding /></Suspense>;

  /*
    The control panel is its own application.

    It renders before the tenant shell and outside it — no bottom nav, no
    business switcher, no "close the day" button under a page about platform
    revenue. Staff running the company are not running a bar, and the two
    should not share furniture.
  */
  if (location.pathname.startsWith('/hq') || location.pathname === '/admin') {
    return isStaff ? <Suspense fallback={<Pending />}><Hq /></Suspense> : <Navigate to="/home" replace />;
  }

  // A lapsed subscription stops the product, not the console: staff need to get
  // into the panel to lift the block in the first place.
  if (activeBusiness?.suspended && !isStaff) return <Suspense fallback={<Pending />}><Suspended /></Suspense>;

  // Money stays open to staff — it is where they record their own entries, and
  // the screen already withholds the profit summary from them. Everything else
  // in this list is owner business.
  // Staff mode with nobody signed in: "Who's working?" in front of everything,
  // so nothing gets recorded under nobody's name.
  if (!owner && activeBusiness && !activeStaff) return <StaffSignIn />;

  const isOwnerOnly = ['/reports', '/ai', '/manage', '/business', '/staff', '/pricing', '/help', '/payouts'].includes(location.pathname) && !owner;
  const salon = activeBusiness?.type === 'barber';
  const retail = activeBusiness?.type === 'retail';
  if (isOwnerOnly) return <Navigate to="/home" replace />;


  return (
    <div className="app-shell">
      <ThemeRoot />
      <ScrollManager />
      <Sidebar />
      <div className="app-main">
        <ScreenBoundary resetKey={location.pathname} sw={profile?.lang === 'sw'}>
        {/*
          The boundary sits inside the keyed page, so every page gets a new one.
          Navigation runs as a transition, and React keeps an already-shown
          boundary on the old page while the next page's code downloads — on a
          slow phone that looked like the app had frozen. A fresh boundary shows
          the loading skeleton at once instead.
        */}
        <div key={location.pathname} className="page-in page-wrap">
        <Suspense fallback={<Pending />}>
        <Routes>
          <Route path="/home" element={salon ? <SalonToday /> : retail ? <ShopHome /> : owner ? <Home /> : <StaffHome />} />
          {retail ? (
            <Route path="/products" element={<ShopProducts />} />
          ) : salon ? (
            <>
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/services" element={<Services />} />
              <Route path="/payouts" element={<Payouts />} />
            </>
          ) : (
            <>
              <Route path="/stock" element={<Stock />} />
              <Route path="/close" element={<Close />} />
              <Route path="/diff" element={<Difference />} />
              <Route path="/approval" element={<Approval />} />
            </>
          )}
          <Route path="/money" element={<Money />} />
          <Route path="/reports" element={salon ? <SalonReports /> : <Reports />} />
          <Route path="/ai" element={<AI />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/business" element={<BusinessProfile />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/help" element={<Help />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </Suspense>
        </div>
        </ScreenBoundary>
      </div>
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <SalonProvider>
          <ToastProvider>
            <IconSprite />
            {/* Outside the routes, so a recovery link opened while signed out
                still reaches the handler, and the back button always works. */}
            <NativeShell />
            <AppRoutes />
          </ToastProvider>
          </SalonProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
