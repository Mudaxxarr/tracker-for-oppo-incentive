package com.alhamdtelecom.salesconsole;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Android 15+ (targetSdk 35+) forces edge-to-edge by default, which the
        // @capacitor/status-bar plugin's overlaysWebView option can't override
        // (it only toggles deprecated systemUiVisibility flags). Opting back into
        // decor-fits-system-windows keeps the WebView content below the status bar.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
