package com.snyderscriptorium.scriptsmith

import android.graphics.Typeface
import android.os.Bundle
import android.text.method.ScrollingMovementMethod
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.File

// v1011: standalone diagnostics launcher. Separate home-screen icon
// ("ScriptSmith Diag") that shows the startup logs on screen — no file
// hunting needed. Does NOT touch the Tauri engine at all.
class DiagActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val tv = TextView(this).apply {
      textSize = 13f
      typeface = Typeface.MONOSPACE
      setTextIsSelectable(true)
      movementMethod = ScrollingMovementMethod.getInstance()
      setPadding(24, 24, 24, 24)
    }
    val scroll = ScrollView(this).apply { addView(tv) }
    setContentView(scroll)
    tv.text = try {
      buildReport()
    } catch (t: Throwable) {
      "DiagActivity failed to build report: ${t.message}\n${t.stackTraceToString().take(2000)}"
    }
  }

  private fun readFile(label: String, f: File, maxChars: Int): String {
    return try {
      if (!f.exists()) return "— $label —\n(missing: ${f.absolutePath})"
      val text = f.readText()
      if (text.isBlank()) return "— $label —\n(empty: ${f.absolutePath})"
      val shown = if (text.length > maxChars) text.take(maxChars) + "\n…(truncated, ${text.length} chars total)" else text
      "— $label —\n(path: ${f.absolutePath})\n$shown"
    } catch (t: Throwable) {
      "— $label —\n(read failed: ${t.message})"
    }
  }

  private fun buildReport(): String {
    val sb = StringBuilder()
    sb.append("ScriptSmith Diagnostics\n")
    sb.append("versionName=${BuildConfig.VERSION_NAME} versionCode=${BuildConfig.VERSION_CODE}\n")
    sb.append("packageName=$packageName\n\n")

    sb.append(readFile("rust-startup.log", File(filesDir, "rust-startup.log"), 4000))
    sb.append("\n\n")
    sb.append(readFile("rust-panic.log", File(filesDir, "rust-panic.log"), 4000))
    sb.append("\n\n")
    sb.append(readFile("webview-diag.log", File(filesDir, "webview-diag.log"), 4000))
    sb.append("\n\n")

    val extDir = try { getExternalFilesDir(null) } catch (_: Throwable) { null }
    if (extDir != null) {
      sb.append(readFile("ScriptSmith-diag.txt (external)", File(extDir, "ScriptSmith-diag.txt"), 4000))
    } else {
      sb.append("— ScriptSmith-diag.txt (external) —\n(getExternalFilesDir returned null)")
    }
    sb.append("\n\n")

    sb.append("— filesDir listing (${filesDir.absolutePath}) —\n")
    try {
      val files = filesDir.listFiles()
      if (files.isNullOrEmpty()) {
        sb.append("(empty or unreadable)")
      } else {
        for (f in files.sortedBy { it.name }) {
          sb.append("${f.name}  ${f.length()} bytes  dir=${f.isDirectory}\n")
        }
      }
    } catch (t: Throwable) {
      sb.append("(listing failed: ${t.message})")
    }
    sb.append("\n\n— done —\nScreenshot this and send it to the developer.")
    return sb.toString()
  }
}
