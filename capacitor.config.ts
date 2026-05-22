import type { CapacitorConfig } from "@capacitor/cli";

// Production URL — update before building APK
const SERVER_URL = process.env.CAPACITOR_SERVER_URL ?? "https://app.alhamdtelecom.com";

const config: CapacitorConfig = {
  appId: "com.alhamdtelecom.salesconsole",
  appName: "Alhamd Sales Console",
  webDir: "out", // not used in server mode; required by Capacitor schema
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: "Light",
      backgroundColor: "#0A6E5C",
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
