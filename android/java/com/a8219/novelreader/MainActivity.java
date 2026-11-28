package com.a8219.novelreader;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Offline reader shell: the whole backend (search, directory, chapter decoding,
 * shelf and history) runs inside this WebView from packaged assets. No sockets,
 * no local server, no outbound port.
 */
public class MainActivity extends Activity {
    private static final int REQUEST_WRITE_STORAGE = 5172;
    private WebView web;
    private volatile boolean trustedLocalPageLoaded;
    private final ExecutorService fileWriter = Executors.newSingleThreadExecutor();
    private final Object pendingLock = new Object();
    private PendingSave pendingSave;

    private static final class PendingSave {
        final String fileName;
        final String content;
        final String callbackId;

        PendingSave(String fileName, String content, String callbackId) {
            this.fileName = fileName;
            this.content = content;
            this.callbackId = callbackId;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        // Local assets are loaded from file://; the embedded worker talks to the
        // book source APIs directly, so cross-origin access is required here only.
        settings.setAllowFileAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        web.addJavascriptInterface(new NativeDownloads(), "NativeDownloads");
        web.setBackgroundColor(Color.parseColor("#FEF7FF"));
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                trustedLocalPageLoaded = url != null && url.startsWith("file:///android_asset/");
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                trustedLocalPageLoaded = url != null && url.startsWith("file:///android_asset/");
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web, new android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT));
        web.loadUrl("file:///android_asset/index.html");
    }

    private boolean isTrustedLocalPage() {
        return trustedLocalPageLoaded;
    }

    private String safeFileName(String raw) {
        String name = raw == null ? "" : raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        while (name.endsWith(".")) name = name.substring(0, name.length() - 1).trim();
        if (name.isEmpty()) name = "novel";
        if (name.length() > 100) name = name.substring(0, 100).trim();
        if (!name.toLowerCase().endsWith(".txt")) name += ".txt";
        return name;
    }

    private void saveTextFile(PendingSave request) {
        try {
            String location;
            if (Build.VERSION.SDK_INT >= 29) {
                location = writeMediaStore(request.fileName, request.content);
            } else {
                location = writeLegacyDownload(request.fileName, request.content);
            }
            postSaveResult(request.callbackId, true, "已保存到 Download/" + new File(location).getName());
        } catch (Exception e) {
            postSaveResult(request.callbackId, false, "保存失败：" + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
        }
    }

    private String writeMediaStore(String fileName, String content) throws IOException {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "text/plain");
        // Use string column names so the APK can still compile with the existing API 23 SDK.
        values.put("relative_path", Environment.DIRECTORY_DOWNLOADS + "/");
        values.put("is_pending", 1);
        Uri collection = Uri.parse("content://media/external/downloads");
        Uri uri = getContentResolver().insert(collection, values);
        if (uri == null) throw new IOException("无法在 Download 目录创建文件");
        boolean success = false;
        try {
            OutputStream output = getContentResolver().openOutputStream(uri, "w");
            if (output == null) throw new IOException("无法写入下载文件");
            try (OutputStream stream = output) {
                stream.write(content.getBytes(StandardCharsets.UTF_8));
                stream.flush();
            }
            ContentValues ready = new ContentValues();
            ready.put("is_pending", 0);
            getContentResolver().update(uri, ready, null, null);
            success = true;
            return fileName;
        } finally {
            if (!success) getContentResolver().delete(uri, null, null);
        }
    }

    @SuppressWarnings("deprecation")
    private String writeLegacyDownload(String fileName, String content) throws IOException {
        File directory = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("无法创建 Download 目录");
        File target = new File(directory, fileName);
        String stem = fileName.endsWith(".txt") ? fileName.substring(0, fileName.length() - 4) : fileName;
        int suffix = 2;
        while (target.exists()) target = new File(directory, stem + " (" + suffix++ + ").txt");
        try (FileOutputStream output = new FileOutputStream(target)) {
            output.write(content.getBytes(StandardCharsets.UTF_8));
            output.flush();
        }
        return target.getAbsolutePath();
    }

    private void postSaveResult(String callbackId, boolean success, String message) {
        if (web == null || callbackId == null || !callbackId.matches("ndSaveCb_[0-9]{1,12}")) return;
        final String script = "(function(){var f=window['" + callbackId + "'];if(typeof f==='function')f(" +
                (success ? "true" : "false") + "," + JSONObject.quote(message) + ");})()";
        web.post(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.evaluateJavascript(script, null);
            }
        });
    }

    private final class NativeDownloads {
        @JavascriptInterface
        public void saveTextFile(String rawName, String content, String callbackId) {
            if (!isTrustedLocalPage()) return;
            if (callbackId == null || !callbackId.matches("ndSaveCb_[0-9]{1,12}")) return;
            if (content == null) {
                postSaveResult(callbackId, false, "没有可保存的内容");
                return;
            }
            final PendingSave request = new PendingSave(safeFileName(rawName), content, callbackId);
            if (Build.VERSION.SDK_INT >= 29 || checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED) {
                fileWriter.execute(new Runnable() {
                    @Override
                    public void run() {
                        MainActivity.this.saveTextFile(request);
                    }
                });
                return;
            }
            synchronized (pendingLock) {
                if (pendingSave != null) {
                    postSaveResult(callbackId, false, "已有下载正在等待存储权限");
                    return;
                }
                pendingSave = request;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQUEST_WRITE_STORAGE);
                }
            });
        }

        @JavascriptInterface
        public void exitApp() {
            if (!isTrustedLocalPage()) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.finish();
                }
            });
        }

        @JavascriptInterface
        public void openGithub() {
            if (!isTrustedLocalPage()) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/a8219/noveldownloader")));
                    } catch (Exception ignored) { }
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_WRITE_STORAGE) return;
        PendingSave request;
        synchronized (pendingLock) {
            request = pendingSave;
            pendingSave = null;
        }
        if (request == null) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            fileWriter.execute(new Runnable() {
                @Override
                public void run() {
                    MainActivity.this.saveTextFile(request);
                }
            });
        } else {
            postSaveResult(request.callbackId, false, "未授予存储权限，无法写入 Download 目录");
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        fileWriter.shutdown();
        super.onDestroy();
    }
}
