package com.snyderscriptorium.scriptsmith

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.method.ScrollingMovementMethod
import android.webkit.WebView
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AlertDialog
import java.io.File

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // v1008: immediate startup toast — proves MainActivity.onCreate runs at all.
    Toast.makeText(this, "ScriptSmith v1011 starting", Toast.LENGTH_LONG).show()
    try {
      enableEdgeToEdge()
      super.onCreate(savedInstanceState)
    } catch (t: Throwable) {
      // If startup itself throws, show the crash report screen instead of dying silently.
      try {
        CrashReporter.writeAndShow(this, t)
      } catch (_: Throwable) {
      }
      finish()
      return
    }
    // v1007 DIAGNOSTIC BUILD: launching a separate Activity (CrashReportActivity)
    // appears to fail silently on the user's phone, so show the diagnostics in an
    // AlertDialog directly on MainActivity instead. Unconditional 10s trigger.
    try {
      WebViewDiag.log(this, "MainActivity.onCreate completed — 10s AlertDialog diagnostics scheduled")
      Handler(Looper.getMainLooper()).postDelayed({
        try {
          val finished = WebViewDiag.mainPageFinished.get()
          val error = WebViewDiag.hadError.get()
          WebViewDiag.log(
            this,
            "DIAG-TRIGGER: 10s AlertDialog — mainPageFinished=$finished hadError=$error mainUrl=${WebViewDiag.mainUrl}"
          )
          showDiagnosticsDialog()
        } catch (t: Throwable) {
          try {
            Toast.makeText(this, "diagnostics failed: ${t.message}", Toast.LENGTH_LONG).show()
          } catch (_: Throwable) {
          }
        }
      }, 10000)
    } catch (_: Throwable) {
    }
  }

  private fun readAppFile(name: String, maxChars: Int): String {
    return try {
      val f = File(filesDir, name)
      if (!f.exists()) return "($name: file missing)"
      val text = f.readText()
      if (text.isBlank()) return "($name: empty)"
      if (text.length > maxChars) text.take(maxChars) + "\n…(truncated, ${text.length} chars total)"
      else text
    } catch (t: Throwable) {
      "($name: read failed: ${t.message})"
    }
  }

  private fun buildDiagnosticsText(): String {
    val sb = StringBuilder()
    sb.append("— webview-diag.log —\n")
    sb.append(WebViewDiag.readLog(this) ?: "(webview-diag.log: missing or empty — onWebViewCreate may never have run)")
    sb.append("\n\n— rust-startup.log —\n")
    sb.append(readAppFile("rust-startup.log", 2000))
    sb.append("\n\n— rust-panic.log —\n")
    sb.append(readAppFile("rust-panic.log", 2000))
    sb.append("\n\nmainPageFinished=${WebViewDiag.mainPageFinished.get()} hadError=${WebViewDiag.hadError.get()} mainUrl=${WebViewDiag.mainUrl}")
    return sb.toString()
  }

  private fun showDiagnosticsDialog() {
    val report = buildDiagnosticsText()
    try {
      val tv = TextView(this).apply {
        text = report
        textSize = 12f
        typeface = Typeface.MONOSPACE
        setTextIsSelectable(true)
        movementMethod = ScrollingMovementMethod.getInstance()
        setPadding(24, 16, 24, 16)
      }
      val scroll = ScrollView(this).apply { addView(tv) }
      AlertDialog.Builder(this)
        .setTitle("ScriptSmith diagnostics")
        .setMessage("Screenshot this, or tap Copy:")
        .setView(scroll)
        .setCancelable(true)
        .setPositiveButton("OK", null)
        .setNeutralButton("Copy") { _, _ ->
          try {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("ScriptSmith diagnostics", report))
            Toast.makeText(this, "Diagnostics copied", Toast.LENGTH_SHORT).show()
          } catch (_: Throwable) {
          }
        }
        .show()
    } catch (t: Throwable) {
      // Fallback: toast with the first 200 chars.
      try {
        Toast.makeText(this, report.take(200), Toast.LENGTH_LONG).show()
      } catch (_: Throwable) {
      }
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    // v1004 DIAGNOSTIC BUILD: probe the page's JS environment and then
    // UNCONDITIONALLY show the diagnostics screen so webview-diag.log
    // can be read off the phone.
    try {
      val handler = Handler(Looper.getMainLooper())
      val probeJs = "JSON.stringify({appHtmlLen:(document.getElementById('app')||{innerHTML:''}).innerHTML.length,hasTauri:typeof window.__TAURI__!=='undefined',hasTauriInternals:typeof window.__TAURI_INTERNALS__!=='undefined',url:location.href,readyState:document.readyState})"
      val runProbe: (String) -> Unit = { tag ->
        try {
          webView.evaluateJavascript(probeJs) { result ->
            try {
              WebViewDiag.log(this, "JS-PROBE[$tag]: $result")
            } catch (_: Throwable) { }
          }
        } catch (t: Throwable) {
          try { WebViewDiag.log(this, "JS-PROBE[$tag] FAILED: ${t.message}") } catch (_: Throwable) { }
        }
      }
      handler.postDelayed({ runProbe("5s") }, 5000)
      handler.postDelayed({ runProbe("9s") }, 9000)
      // NOTE (v1005+): the unconditional 10s report trigger lives in onCreate,
      // because onWebViewCreate may never be called at all. v1007 shows it as
      // an AlertDialog instead of launching CrashReportActivity.
    } catch (_: Throwable) {
    }
  }
}
