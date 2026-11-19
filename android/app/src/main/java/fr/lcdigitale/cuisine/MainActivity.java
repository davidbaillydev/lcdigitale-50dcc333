package fr.lcdigitale.cuisine;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

/** Tablette cuisine : écran toujours allumé, plein écran immersif, sons sans geste préalable. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LcKitchenPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        LcKitchenPlugin.immersive(this, true);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && LcKitchenPlugin.fullscreenWanted) LcKitchenPlugin.immersive(this, true);
    }
}
