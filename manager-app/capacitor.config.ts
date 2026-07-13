import type { CapacitorConfig } from "@capacitor/cli";

const SERVER_URL =
  process.env.CAPACITOR_MANAGER_SERVER_URL ??
  "https://oppo-tracker.vercel.app/manager";

const config: CapacitorConfig = {
  appId: "com.alhamdtelecom.incentomanager",
  appName: "Incento Manager",
  webDir: "www",
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
  android: {
    path: "android",
    backgroundColor: "#f6f7f8",
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: "Light",
      backgroundColor: "#0A6E5C",
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#0A6E5C",
      androidSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      showSpinner: true,
    },
  },
};

export default config;
