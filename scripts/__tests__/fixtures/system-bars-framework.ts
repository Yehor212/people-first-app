// Isolated Android boundary doubles. The test compiles the complete installed
// SystemBars.java unchanged against these types; none enter the app bundle.
export const systemBarsFrameworkSources: Record<string, string> = {
  "android/R.java": `package android;
public final class R { public static final class attr { public static final int windowBackground = 1; } }`,
  "android/content/Context.java": `package android.content;
import android.content.res.Resources;
public class Context {
  private final Resources resources = new Resources();
  public Resources getResources() { return resources; }
  public Resources.Theme getTheme() { return new Resources.Theme(); }
}`,
  "android/app/Activity.java": `package android.app;
public class Activity extends android.content.Context {
  private final android.view.Window window = new android.view.Window();
  public android.view.Window getWindow() { return window; }
  public void runOnUiThread(Runnable action) { action.run(); }
}`,
  "android/content/pm/PackageInfo.java": `package android.content.pm;
public class PackageInfo { public String versionName; }`,
  "android/content/res/Configuration.java": `package android.content.res;
public class Configuration {
  public static final int UI_MODE_NIGHT_MASK = 48;
  public static final int UI_MODE_NIGHT_YES = 32;
  public int uiMode;
}`,
  "android/content/res/Resources.java": `package android.content.res;
public class Resources {
  public Configuration getConfiguration() { return new Configuration(); }
  public android.util.DisplayMetrics getDisplayMetrics() { return new android.util.DisplayMetrics(); }
  public static class Theme {
    public boolean resolveAttribute(int id, android.util.TypedValue value, boolean resolve) { value.data = 0; return true; }
  }
}`,
  "android/util/DisplayMetrics.java": `package android.util;
public class DisplayMetrics { public float density = 2.625f; }`,
  "android/util/TypedValue.java": `package android.util;
public class TypedValue { public int data; }`,
  "android/os/Build.java": `package android.os;
public class Build {
  public static class VERSION { public static int SDK_INT = 36; }
  public static class VERSION_CODES { public static final int VANILLA_ICE_CREAM = 35; }
}`,
  "android/view/View.java": `package android.view;
public class View {
  public View parent;
  public int[] padding = {9, 8, 7, 6};
  public int paddingWrites;
  public Object getParent() { return parent; }
  public void setPadding(int left, int top, int right, int bottom) {
    padding = new int[] {left, top, right, bottom}; paddingWrites++;
  }
  public void setBackgroundColor(int color) {}
}`,
  "android/view/Window.java": `package android.view;
public class Window {
  private final View decor = new View();
  public View getDecorView() { return decor; }
}`,
  "android/webkit/JavascriptInterface.java": `package android.webkit;
public @interface JavascriptInterface {}`,
  "android/webkit/ValueCallback.java": `package android.webkit;
public interface ValueCallback<T> { void onReceiveValue(T value); }`,
  "android/webkit/WebView.java": `package android.webkit;
public class WebView extends android.view.View {
  public int evaluations;
  public int insetRequests;
  public void addJavascriptInterface(Object object, String name) {}
  public void evaluateJavascript(String script, ValueCallback<String> callback) {
    evaluations++;
    if (callback != null) callback.onReceiveValue("true");
  }
  public void requestApplyInsets() { insetRequests++; }
}`,
  "androidx/core/graphics/Insets.java": `package androidx.core.graphics;
public final class Insets {
  public final int left, top, right, bottom;
  private Insets(int l, int t, int r, int b) { left=l; top=t; right=r; bottom=b; }
  public static Insets of(int l, int t, int r, int b) { return new Insets(l,t,r,b); }
}`,
  "androidx/core/view/WindowInsetsCompat.java": `package androidx.core.view;
import androidx.core.graphics.Insets;
public class WindowInsetsCompat {
  public static final WindowInsetsCompat CONSUMED = new WindowInsetsCompat(Insets.of(0,0,0,0), Insets.of(0,0,0,0), false);
  public Insets system, ime;
  public boolean keyboard;
  public WindowInsetsCompat(Insets system, Insets ime, boolean keyboard) { this.system=system; this.ime=ime; this.keyboard=keyboard; }
  public Insets getInsets(int type) { return type == Type.ime() ? ime : system; }
  public boolean isVisible(int type) { return type == Type.ime() && keyboard; }
  public static class Type {
    public static int systemBars() { return 1; }
    public static int displayCutout() { return 2; }
    public static int ime() { return 4; }
    public static int statusBars() { return 8; }
    public static int navigationBars() { return 16; }
  }
  public static class Builder {
    private final WindowInsetsCompat value;
    public Builder(WindowInsetsCompat source) { value=new WindowInsetsCompat(source.system,source.ime,source.keyboard); }
    public Builder setInsets(int type, Insets insets) {
      if (type == Type.ime()) value.ime=insets; else value.system=insets;
      return this;
    }
    public WindowInsetsCompat build() { return value; }
  }
}`,
  "androidx/core/view/OnApplyWindowInsetsListener.java": `package androidx.core.view;
public interface OnApplyWindowInsetsListener {
  WindowInsetsCompat onApplyWindowInsets(android.view.View view, WindowInsetsCompat insets);
}`,
  "androidx/core/view/ViewCompat.java": `package androidx.core.view;
import android.view.View;
import java.util.IdentityHashMap;
public class ViewCompat {
  public static WindowInsetsCompat rootInsets;
  public static final IdentityHashMap<View,OnApplyWindowInsetsListener> listeners = new IdentityHashMap<>();
  public static void setOnApplyWindowInsetsListener(View view, OnApplyWindowInsetsListener listener) { listeners.put(view, listener); }
  public static WindowInsetsCompat getRootWindowInsets(View view) { return rootInsets; }
}`,
  "androidx/core/view/WindowCompat.java": `package androidx.core.view;
public class WindowCompat {
  public static WindowInsetsControllerCompat getInsetsController(android.view.Window window, android.view.View view) { return new WindowInsetsControllerCompat(); }
}`,
  "androidx/core/view/WindowInsetsControllerCompat.java": `package androidx.core.view;
public class WindowInsetsControllerCompat {
  public void setAppearanceLightStatusBars(boolean light) {}
  public void setAppearanceLightNavigationBars(boolean light) {}
  public void hide(int type) {}
  public void show(int type) {}
}`,
  "androidx/webkit/WebViewCompat.java": `package androidx.webkit;
public class WebViewCompat {
  public static String version = "133.0.0.0";
  public static android.content.pm.PackageInfo getCurrentWebViewPackage(android.content.Context context) {
    android.content.pm.PackageInfo info = new android.content.pm.PackageInfo(); info.versionName=version; return info;
  }
}`,
  "com/getcapacitor/PluginConfig.java": `package com.getcapacitor;
public class PluginConfig {
  public final java.util.Map<String,Object> values = new java.util.HashMap<>();
  public String getString(String key, String fallback) { return values.containsKey(key) ? (String)values.get(key) : fallback; }
  public boolean getBoolean(String key, boolean fallback) { return values.containsKey(key) ? (Boolean)values.get(key) : fallback; }
}`,
  "com/getcapacitor/Bridge.java": `package com.getcapacitor;
public class Bridge {
  private final android.webkit.WebView view = new android.webkit.WebView();
  public Bridge() { view.parent = new android.view.View(); }
  public android.webkit.WebView getWebView() { return view; }
  public void executeOnMainThread(Runnable action) { action.run(); }
  public void addWebViewListener(WebViewListener listener) {}
}`,
  "com/getcapacitor/Plugin.java": `package com.getcapacitor;
public class Plugin {
  protected final Bridge bridge = new Bridge();
  private final android.app.Activity activity = new android.app.Activity();
  private final PluginConfig config = new PluginConfig();
  public void load() {}
  protected void handleOnStart() {}
  protected void handleOnConfigurationChanged(android.content.res.Configuration configuration) {}
  public Bridge getBridge() { return bridge; }
  public android.app.Activity getActivity() { return activity; }
  public android.content.Context getContext() { return activity; }
  public PluginConfig getConfig() { return config; }
}`,
  "com/getcapacitor/PluginCall.java": `package com.getcapacitor;
public class PluginCall {
  public String getString(String key, String fallback) { return fallback; }
  public boolean getBoolean(String key, boolean fallback) { return fallback; }
  public void resolve() {}
}`,
  "com/getcapacitor/PluginMethod.java": `package com.getcapacitor;
public @interface PluginMethod {}`,
  "com/getcapacitor/WebViewListener.java": `package com.getcapacitor;
public class WebViewListener { public void onPageCommitVisible(android.webkit.WebView view, String url) {} }`,
  "com/getcapacitor/annotation/CapacitorPlugin.java": `package com.getcapacitor.annotation;
public @interface CapacitorPlugin {}`,
  "com/getcapacitor/plugin/SystemBarsHarness.java": `package com.getcapacitor.plugin;
import android.os.Build;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.*;
import androidx.webkit.WebViewCompat;
public class SystemBarsHarness {
  public static void main(String[] args) {
    Build.VERSION.SDK_INT = Integer.parseInt(args[1]);
    WebViewCompat.version = args[2] + ".0.0.0";
    boolean keyboard = Boolean.parseBoolean(args[3]);
    WindowInsetsCompat incoming = new WindowInsetsCompat(Insets.of(4,52,6,24), Insets.of(0,0,0,600), keyboard);
    ViewCompat.rootInsets = incoming;
    SystemBars plugin = new SystemBars();
    plugin.getConfig().values.put("insetsHandling", args[0]);
    android.webkit.WebView web = plugin.getBridge().getWebView();
    View parent = (View) web.getParent();
    int[] ownerCalls = {0};
    OnApplyWindowInsetsListener owner = (view, insets) -> { ownerCalls[0]++; return insets; };
    ViewCompat.setOnApplyWindowInsetsListener(parent, owner);
    plugin.load();
    plugin.onDOMReady();
    WindowInsetsCompat returned = ViewCompat.listeners.get(parent).onApplyWindowInsets(parent, incoming);
    int[] p = parent.padding;
    System.out.printf(java.util.Locale.ROOT,
      "{\\"ownerCalls\\":%d,\\"padding\\":[%d,%d,%d,%d],\\"paddingWrites\\":%d,\\"evaluations\\":%d,\\"insetRequests\\":%d,\\"returnedBottom\\":%d}%n",
      ownerCalls[0],p[0],p[1],p[2],p[3],parent.paddingWrites,web.evaluations,web.insetRequests,returned.system.bottom);
  }
}`,
};
