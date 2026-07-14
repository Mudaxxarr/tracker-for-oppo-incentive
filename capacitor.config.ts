import type { CapacitorConfig } from "@capacitor/cli";

// Production URL — update before building APK
const SERVER_URL = process.env.CAPACITOR_SERVER_URL ?? "https://oppo-tracker.vercel.app";

const config: CapacitorConfig = {
  appId: "com.alhamdtelecom.salesconsole",
  appName: "Incento",
  webDir: "out", // not used in server mode; required by Capacitor schema
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
    // Lets the server (middleware) tell this installed app apart from a normal
    // mobile browser — used to force dealer-only login and hide any admin path.
    appendUserAgent: "IncentoDealerApp",
  },
  plugins: {
    StatusBar: {
      style: "Light",
      backgroundColor: "#0A6E5C",
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0A6E5C",
      androidSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      showSpinner: true,
    },
  },
};

export default config;
