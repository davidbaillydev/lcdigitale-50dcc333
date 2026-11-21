package fr.lcdigitale.cuisine;

import android.app.Activity;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.util.Base64;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * Pont natif de la tablette cuisine : anti-veille, plein écran / épinglage, sonnerie système
 * et impression ESC/POS brute en TCP (port 9100) vers une imprimante du réseau local, sans passerelle.
 */
@CapacitorPlugin(name = "LcKitchen")
public class LcKitchenPlugin extends Plugin {
    static boolean fullscreenWanted = true;

    static void immersive(Activity a, boolean on) {
        fullscreenWanted = on;
        WindowCompat.setDecorFitsSystemWindows(a.getWindow(), !on);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(a.getWindow(), a.getWindow().getDecorView());
        if (on) {
            c.hide(WindowInsetsCompat.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            c.show(WindowInsetsCompat.Type.systemBars());
        }
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("native", true);
        r.put("version", 1);
        call.resolve(r);
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = BuildConfig.IS_KIOSK || call.getBoolean("on", true);
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @PluginMethod
    public void setFullscreen(PluginCall call) {
        boolean on = BuildConfig.IS_KIOSK || call.getBoolean("on", true);
        getActivity().runOnUiThread(() -> { immersive(getActivity(), on); call.resolve(); });
    }

    /** Épinglage d'écran (lock task) : empêche de quitter l'application pendant le service. */
    @PluginMethod
    public void lockTask(PluginCall call) {
        boolean on = call.getBoolean("on", true);
        getActivity().runOnUiThread(() -> {
            try {
                if (on) getActivity().startLockTask(); else getActivity().stopLockTask();
                call.resolve();
            } catch (Exception e) { call.reject("Épinglage refusé par l'appareil"); }
        });
    }

    /** Sonnerie système sur le flux alarme : audible même si le volume média est coupé. */
    @PluginMethod
    public void ring(PluginCall call) {
        try {
            Context ctx = getContext();
            Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            Ringtone r = RingtoneManager.getRingtone(ctx, uri);
            r.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
            r.play();
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            JSObject res = new JSObject();
            res.put("alarmVolume", am.getStreamVolume(AudioManager.STREAM_ALARM));
            call.resolve(res);
        } catch (Exception e) { call.reject("Sonnerie indisponible"); }
    }

    static boolean isLocal(InetAddress a) {
        return a.isSiteLocalAddress() || a.isLinkLocalAddress();
    }

    /** Envoi brut en TCP ; limité aux adresses du réseau local (imprimantes ticket). */
    @PluginMethod
    public void print(PluginCall call) {
        String host = call.getString("host");
        int port = call.getInt("port", 9100);
        String data = call.getString("data");
        if (host == null || data == null) { call.reject("Adresse ou données manquantes"); return; }
        new Thread(() -> {
            try {
                InetAddress addr = InetAddress.getByName(host);
                if (!isLocal(addr)) { call.reject("Seules les imprimantes du réseau local sont autorisées"); return; }
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                try (Socket s = new Socket()) {
                    s.connect(new InetSocketAddress(addr, port), 4000);
                    s.setSoTimeout(8000);
                    OutputStream out = s.getOutputStream();
                    out.write(bytes);
                    out.flush();
                }
                call.resolve();
            } catch (Exception e) { call.reject("Imprimante injoignable : " + e.getMessage()); }
        }).start();
    }

    /** Recherche des imprimantes (port 9100 ouvert) sur le /24 de la tablette. */
    @PluginMethod
    public void discover(PluginCall call) {
        String base = call.getString("subnet");
        if (base == null) { call.reject("Sous-réseau manquant (ex. 192.168.1)"); return; }
        new Thread(() -> {
            com.getcapacitor.JSArray found = new com.getcapacitor.JSArray();
            Thread[] ts = new Thread[254];
            for (int i = 1; i <= 254; i++) {
                final String h = base + "." + i;
                ts[i - 1] = new Thread(() -> {
                    try (Socket s = new Socket()) {
                        s.connect(new InetSocketAddress(h, 9100), 400);
                        synchronized (found) { found.put(h); }
                    } catch (Exception ignored) { }
                });
                ts[i - 1].start();
            }
            for (Thread t : ts) { try { t.join(); } catch (InterruptedException ignored) { } }
            JSObject r = new JSObject();
            r.put("printers", found);
            call.resolve(r);
        }).start();
    }
}
