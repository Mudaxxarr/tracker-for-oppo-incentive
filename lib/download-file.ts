/**
 * Trigger a file download for a same-origin URL using a real anchor click
 * (not `window.open`). A synchronous anchor navigation preserves the user
 * gesture on mobile browsers and — crucially — is the navigation the Capacitor
 * Android WebView's DownloadListener hooks into (it never fires for
 * `window.open`/popups), so report PDFs/Excel download inside the installed app.
 */
export function downloadFile(href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
