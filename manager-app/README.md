# Incento Manager Android app

This is a separate Capacitor wrapper for the owner-only `/manager` route.
It uses the application ID `com.alhamdtelecom.incentomanager`, so it can be
installed alongside the regular Incento dealer app.

Version 1.1 hands authenticated report and backup attachments from the WebView
to Android's Download Manager. Files are saved in the device's Downloads folder
and remain authenticated with the active dealer session.

From the repository root:

```powershell
npm run manager:cap:sync
npm run manager:apk
```

The build helper automatically selects an installed Java 21 JDK, which is
required by Capacitor 8, and disables Gradle's optional HTML problems report
to avoid a Windows file-collision seen on this workstation.

The installable debug APK is generated at:

```text
manager-app/android/app/build/outputs/apk/debug/app-debug.apk
```

To point a build at a different deployment, set `CAPACITOR_MANAGER_SERVER_URL`
to the full `/manager` URL before syncing.
