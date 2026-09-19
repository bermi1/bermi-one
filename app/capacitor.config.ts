import type { CapacitorConfig } from '@capacitor/cli';

/*
  The native shell.

  Assets are bundled, not loaded from a server. A native app that is only a
  window onto a website is exactly what Apple's guideline 4.2 and Google's
  minimum-functionality policy exist to reject, and it also means the app is
  dead the moment the phone is out of signal — which, for a bar counting stock
  at eleven at night in Moshi, is most nights.

  androidScheme is https so the webview's origin is https://localhost: a http
  origin puts the app in an insecure context, where Web Crypto and a good deal
  else quietly stops working.
*/
const config: CapacitorConfig = {
  appId: 'one.bermi.app',
  appName: 'Bermi One',
  webDir: 'dist',
  android: {
    // Mixed content off: everything the app talks to is https already, and a
    // webview that will load http is a webview someone can inject into.
    allowMixedContent: false,
    captureInput: true,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      // The web app paints its own boot screen in index.html. The native splash
      // hands over to it rather than fading out into white first.
      launchAutoHide: false,
      backgroundColor: '#0B1020',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#2F5BFF',
    },
    Keyboard: {
      resize: 'body',
    },
  },
};

export default config;
