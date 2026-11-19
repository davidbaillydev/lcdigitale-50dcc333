package fr.lcdigitale.cuisine;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
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
        checkWebView();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && LcKitchenPlugin.fullscreenWanted) LcKitchenPlugin.immersive(this, true);
    }

    /** Le site exige un moteur Chrome récent (111+) : sinon on propose la mise à jour au lieu d'une page cassée. */
    private void checkWebView() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        PackageInfo info = WebView.getCurrentWebViewPackage();
        if (info == null || info.versionName == null) return;
        int major;
        try { major = Integer.parseInt(info.versionName.split("\\.")[0]); } catch (Exception e) { return; }
        if (major >= 111) return;
        final String pkg = info.packageName;
        new AlertDialog.Builder(this)
            .setTitle("Mise à jour nécessaire")
            .setMessage("Le composant « Android System WebView » de cette tablette est trop ancien (version " + major + "). Mettez-le à jour depuis le Play Store, puis relancez LC Cuisine.")
            .setCancelable(false)
            .setPositiveButton("Mettre à jour", (d, w) -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg))); }
                catch (Exception e) { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + pkg))); }
            })
            .setNegativeButton("Continuer", null)
            .show();
    }
}
