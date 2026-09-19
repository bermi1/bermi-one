import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { supabase } from '../lib/supabase';
import { isNative } from '../lib/native';
import { useAuth } from '../state/AuthContext';
import { useData } from '../state/DataContext';

/*
  The parts of the app that only exist because it is an app.

  Everything here is a no-op on the web. It is mounted inside the router so the
  back button and the deep-link handler can navigate, and inside the providers
  so a recovery link can tell the auth context what it just did.
*/
export function NativeShell() {
  const nav = useNavigate();
  const location = useLocation();
  const { beginRecovery } = useAuth();
  const { profile } = useData();
  const theme = profile?.theme || 'light';

  // --- splash and status bar ------------------------------------------------
  useEffect(() => {
    if (!isNative()) return;
    // Hidden once React has painted, not on a timer. A splash that leaves early
    // shows a white rectangle; one that leaves late feels like a slow app.
    void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isNative()) return;
    // The bar sits above the app's own header, so it has to follow the theme or
    // it reads as a rendering fault.
    void StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#0B1020' : '#FFFFFF' }).catch(() => {});
  }, [theme]);

  // --- deep links -----------------------------------------------------------
  useEffect(() => {
    if (!isNative()) return;

    const handle = CapApp.addListener('appUrlOpen', ({ url }) => {
      void (async () => {
        let parsed: URL;
        try { parsed = new URL(url); } catch { return; }

        // Supabase puts the exchange code in the query string under PKCE, and
        // older links put it in the fragment. Read both rather than assume.
        const query = parsed.searchParams;
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const code = query.get('code') ?? hash.get('code');
        const type = query.get('type') ?? hash.get('type');
        const problem = query.get('error_description') ?? hash.get('error_description');

        if (problem) { nav('/home'); return; }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) return;
          // A recovery link produces a real session, but the person still does
          // not know their password. Say so, or they are signed in today and
          // locked out tomorrow.
          if (type === 'recovery') beginRecovery();
          nav(type === 'recovery' ? '/home' : parsed.pathname || '/home');
          return;
        }

        // A plain link into the app — /legal/privacy from an email, say.
        if (parsed.pathname && parsed.pathname !== '/') nav(parsed.pathname);
      })();
    });

    return () => { void handle.then((h) => h.remove()); };
  }, [nav, beginRecovery]);

  // --- the hardware back button --------------------------------------------
  useEffect(() => {
    if (!isNative()) return;

    const handle = CapApp.addListener('backButton', ({ canGoBack }) => {
      // Android users press this constantly and expect it to mean something.
      // From the home screen it leaves the app; from anywhere else it goes back,
      // and if there is no history to go back to, it goes home.
      if (location.pathname === '/home') { void CapApp.exitApp(); return; }
      if (canGoBack) { nav(-1); return; }
      nav('/home');
    });

    return () => { void handle.then((h) => h.remove()); };
  }, [nav, location.pathname]);

  return null;
}
