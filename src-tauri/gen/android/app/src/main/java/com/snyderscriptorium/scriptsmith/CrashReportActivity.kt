package com.snyderscriptorium.scriptsmith

import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Space
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.File

/**
 * Shown instead of a bare "keeps stopping" dialog when the app crashes.
 * Displays the captured stack trace so the user can screenshot it and send it in.
 * Layout is built programmatically so no new resources are needed.
 */
class CrashReportActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val pad = (16 * resources.displayMetrics.density).toInt()

    val title = TextView(this).apply {
      text = "ScriptSmith hit a problem"
      textSize = 20f
      setTypeface(typeface, Typeface.BOLD)
    }
    val hint = TextView(this).apply {
      text = "The app couldn't start. Please take a screenshot of this page and send it to us — it shows exactly what went wrong:"
      textSize = 14f
    }
    val body = TextView(this).apply {
      text = buildReportText()
      setTextIsSelectable(true)
      textSize = 12f
      typeface = Typeface.MONOSPACE
    }
    val spacer1 = Space(this).apply { minimumHeight = pad / 2 }
    val spacer2 = Space(this).apply { minimumHeight = pad / 2 }
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.START
      setPadding(pad, pad, pad, pad)
      addView(title)
      addView(spacer1)
      addView(hint)
      addView(spacer2)
      addView(body)
    }
    val scroll = ScrollView(this).apply { addView(layout) }
    setContentView(scroll)
  }

  private fun buildReportText(): String {
    val sb = StringBuilder()
    sb.append("— Rust panic log —\n")
    sb.append(readAppFile("rust-panic.log") ?: "(empty — no Rust panic recorded)")
    sb.append("\n\n— Rust startup log —\n")
    sb.append(readAppFile("rust-startup.log") ?: "(empty — Rust run() never started)")
    sb.append("\n\n— Java crash log —\n")
    sb.append(readCrashLog())
    sb.append("\n\n— WebView diagnostics —\n")
    sb.append(readAppFile("webview-diag.log") ?: "(empty — no WebView events recorded)")
    return sb.toString()
  }

  /** Reads a file from the app's internal files dir (where the Rust code writes). */
  private fun readAppFile(name: String): String? {
    return try {
      val f = File(filesDir, name)
      if (f.exists()) f.readText().takeIf { it.isNotBlank() } else null
    } catch (_: Exception) {
      null
    }
  }

  private fun readCrashLog(): String {
    val candidates = listOfNotNull(
      getExternalFilesDir(null)?.let { File(it, "crash.log") },
      File(filesDir, "crash.log")
    )
    for (f in candidates) {
      try {
        if (f.exists()) return f.readText()
      } catch (_: Exception) {
      }
    }
    return "(no crash log was written)"
  }
}
