import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';
import { DataProvider, useData } from './state/DataContext';
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

/*
  What loads first, and what waits.

  Home, Stock, Close and Difference are the app: a bar opens it to count and to
  see the day. Everything else — the whole control panel above all, which no
  tenant will ever open — is fetched when someone actually asks for it. On a
  phone on a Tanzanian mobile network that difference is the difference between
  the app opening and the app appearing to be broken.
*/
const Onboarding = lazy(() => import('./routes/Onboarding').then((m) => ({ default: m.Onboarding })));
const Approval = lazy(() => import('./routes/Approval').then((m) => ({ default: m.Approval })));
const Money = lazy(() => import('./routes/Money').then((m) => ({ default: m.Money })));
const Reports = lazy(() => import('./routes/Reports').then((m) => ({ default: m.Reports })));
const AI = lazy(() => import('./routes/AI').then((m) => ({ default: m.AI })));
const Manage = lazy(() => import('./routes/Manage').then((m) => ({ default: m.Manage })));
const BusinessProfile = lazy(() => import('./routes/BusinessProfile').then((m) => ({ default: m.BusinessProfile })));
const Staff = lazy(() => import('./routes/Staff').then((m) => ({ default: m.Staff })));
const Hq = lazy(() => import('./portal/Hq').then((m) => ({ default: m.Hq })));
const Suspended = lazy(() => import('./routes/Suspended').then((m) => ({ default: m.Suspended })));
const Pricing = lazy(() => import('./routes/Pricing').then((m) => ({ default: m.Pricing })));
const Help = lazy(() => import('./routes/Help').then((m) => ({ default: m.Help })));
const Legal = lazy(() => import('./routes/Legal').then((m) => ({ default: m.Legal })));
const SetPassword = lazy(() => import('./routes/SetPassword').then((m) => ({ default: m.SetPassword })));

/**
 * What fills the gap while a screen is fetched.
 *
 * Deliberately blank rather than a spinner: on any connection worth the name
 * the chunk arrives inside a frame or two, and a spinner that flashes for
 * 80ms reads as a fault rather than as progress.
 */
function Pending() {
  return <div style={{ minHeight: '40vh' }} />;
}
import { checkPlatformAdmin } from './lib/platform';

function ThemeRoot() {
  const { profile } = useData();
  const theme = profile?.theme || 'light';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
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

function AppRoutes() {
  const { session, loading: authLoading, recovering } = useAuth();
  const { ready, profile, activeBusiness } = useData();
  const location = useLocation();
  const owner = profile?.role === 'owner';

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

  // Still starting up: nothing to show that the splash is not already showing
  // better. Returning null keeps the boot screen on the glass.
  if (authLoading || (session && !ready)) return null;

  handOverFromSplash();

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
  const isOwnerOnly = ['/reports', '/ai', '/manage', '/business', '/staff', '/pricing', '/help'].includes(location.pathname) && !owner;
  if (isOwnerOnly) return <Navigate to="/home" replace />;


  return (
    <div className="app-shell">
      <ThemeRoot />
      <Sidebar />
      <div className="app-main">
        <Suspense fallback={<Pending />}>
        <Routes>
          <Route path="/home" element={owner ? <Home /> : <StaffHome />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/close" element={<Close />} />
          <Route path="/diff" element={<Difference />} />
          <Route path="/approval" element={<Approval />} />
          <Route path="/money" element={<Money />} />
          <Route path="/reports" element={<Reports />} />
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
          <ToastProvider>
            <IconSprite />
            {/* Outside the routes, so a recovery link opened while signed out
                still reaches the handler, and the back button always works. */}
            <NativeShell />
            <AppRoutes />
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
