package com.alhamdtelecom.salesconsole;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int DOWNLOAD_PERMISSION_REQUEST = 4107;

    private PendingDownload pendingDownload;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15+ (targetSdk 35+) forces edge-to-edge by default, which the
        // @capacitor/status-bar plugin's overlaysWebView option can't override
        // (it only toggles deprecated systemUiVisibility flags). Opting back into
        // decor-fits-system-windows keeps the WebView content below the status bar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        // The WebView silently ignores file downloads — report PDFs/Excel are
        // served with Content-Disposition: attachment, so tapping Download did
        // nothing. Hand them to Android's DownloadManager. The WebView's session
        // cookie MUST be forwarded, or the request is unauthenticated and would
        // download the login page instead of the report.
        getBridge().getWebView().setDownloadListener(
            (url, userAgent, contentDisposition, mimeType, contentLength) ->
                startDownload(url, userAgent, contentDisposition, mimeType)
        );
    }

    private void startDownload(
        String url,
        String userAgent,
        String contentDisposition,
        String mimeType
    ) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
            && ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            pendingDownload = new PendingDownload(url, userAgent, contentDisposition, mimeType);
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.WRITE_EXTERNAL_STORAGE },
                DOWNLOAD_PERMISSION_REQUEST
            );
            return;
        }

        enqueueDownload(url, userAgent, contentDisposition, mimeType);
    }

    private void enqueueDownload(
        String url,
        String userAgent,
        String contentDisposition,
        String mimeType
    ) {
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String cookies = CookieManager.getInstance().getCookie(url);
            if (hasText(cookies)) {
                request.addRequestHeader("Cookie", cookies);
            }
            if (hasText(userAgent)) {
                request.addRequestHeader("User-Agent", userAgent);
            }

            String currentPage = getBridge().getWebView().getUrl();
            if (hasText(currentPage)) {
                request.addRequestHeader("Referer", currentPage);
            }
            if (hasText(mimeType)) {
                request.setMimeType(mimeType);
            }

            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            request.setTitle(fileName);
            request.setDescription("Downloading " + fileName);
            request.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
            );
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

            DownloadManager downloadManager =
                (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            downloadManager.enqueue(request);
            Toast.makeText(this, "Download started: " + fileName, Toast.LENGTH_LONG).show();
        } catch (RuntimeException error) {
            Toast.makeText(
                this,
                "Could not start download. Please try again.",
                Toast.LENGTH_LONG
            ).show();
        }
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        @NonNull String[] permissions,
        @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != DOWNLOAD_PERMISSION_REQUEST) return;

        PendingDownload download = pendingDownload;
        pendingDownload = null;
        if (download == null) return;

        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            enqueueDownload(
                download.url,
                download.userAgent,
                download.contentDisposition,
                download.mimeType
            );
        } else {
            Toast.makeText(
                this,
                "Storage permission is needed to save downloads.",
                Toast.LENGTH_LONG
            ).show();
        }
    }

    private static final class PendingDownload {
        final String url;
        final String userAgent;
        final String contentDisposition;
        final String mimeType;

        PendingDownload(
            String url,
            String userAgent,
            String contentDisposition,
            String mimeType
        ) {
            this.url = url;
            this.userAgent = userAgent;
            this.contentDisposition = contentDisposition;
            this.mimeType = mimeType;
        }
    }
}
