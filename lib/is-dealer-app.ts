/**
 * Marker Capacitor's Android WebView appends to every request's User-Agent
 * (see capacitor.config.ts `android.appendUserAgent`). Lets the server tell
 * "request came from the installed dealer app" apart from a normal browser,
 * without any client-side flash of the wrong screen.
 */
export const DEALER_APP_UA_MARKER = "IncentoDealerApp";

export function isDealerAppUserAgent(userAgent: string | null): boolean {
  return !!userAgent && userAgent.includes(DEALER_APP_UA_MARKER);
}
