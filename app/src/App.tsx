import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './state/AuthContext';
import { DataProvider, useData } from './state/DataContext';
import { ToastProvider } from './state/ToastContext';
import { IconSprite } from './lib/icons';
import { BottomNav } from './components/BottomNav';
import { InstallPrompt } from './components/InstallPrompt';
import { Sidebar } from './components/Sidebar';
import { AuthScreen } from './routes/AuthScreen';
import { Onboarding } from './routes/Onboarding';
import { Home } from './routes/Home';
import { StaffHome } from './routes/StaffHome';
import { Stock } from './routes/Stock';
import { Close } from './routes/Close';
import { Difference } from './routes/Difference';
import { Approval } from './routes/Approval';
import { Money } from './routes/Money';
import { Reports } from './routes/Reports';
import { AI } from './routes/AI';
import { Manage } from './routes/Manage';
import { BusinessProfile } from './routes/BusinessProfile';
import { Staff } from './routes/Staff';
import { Hq } from './portal/Hq';
import { Suspended } from './routes/Suspended';
import { Pricing } from './routes/Pricing';
import { Help } from './routes/Help';
import { checkPlatformAdmin } from './lib/platform';

function ThemeRoot() {
  const { profile } = useData();
  const theme = profile?.theme || 'light';
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}

function Spinner() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: 'var(--ink3)', fontWeight: 600 }}>Loading…</div>
  );
}

function AppRoutes() {
  const { session, loading: authLoading } = useAuth();
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

  if (authLoading || (session && !ready)) return <Spinner />;
  if (!session) return <AuthScreen />;
  if (!profile?.onboarded) return <Onboarding />;

  /*
    The control panel is its own application.

    It renders before the tenant shell and outside it — no bottom nav, no
    business switcher, no "close the day" button under a page about platform
    revenue. Staff running the company are not running a bar, and the two
    should not share furniture.
  */
  if (location.pathname.startsWith('/hq') || location.pathname === '/admin') {
    return isStaff ? <Hq /> : <Navigate to="/home" replace />;
  }

  // A lapsed subscription stops the product, not the console: staff need to get
  // into the panel to lift the block in the first place.
  if (activeBusiness?.suspended && !isStaff) return <Suspended />;

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
            <AppRoutes />
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
