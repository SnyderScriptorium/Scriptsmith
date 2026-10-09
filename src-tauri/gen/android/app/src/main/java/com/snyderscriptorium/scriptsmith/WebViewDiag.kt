package com.snyderscriptorium.scriptsmith

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

/**
 * WebView lifecycle diagnostics. Appends timestamped lines to
 * filesDir/webview-diag.log so the CrashReportActivity can show what the
 * WebView was doing. Every method is exception-proof — diagnostics must
 * never break the app they are observing.
 */
object WebViewDiag {
  const val LOG_NAME = "webview-diag.log"

  /** Set when onPageFinished fires for the first URL the WebView started loading. */
  val mainPageFinished = AtomicBoolean(false)

  /** Set when any main-frame load error or HTTP error is observed. */
  val hadError = AtomicBoolean(false)

  /** First URL passed to onPageStarted — treated as the main page. */
  @Volatile var mainUrl: String? = null

  fun log(context: Context, line: String) {
    try {
      val ts = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
      File(context.filesDir, LOG_NAME).appendText("[$ts] $line\n")
    } catch (_: Throwable) {
    }
  }

  fun markPageStarted(url: String) {
    try {
      if (mainUrl == null) mainUrl = url
    } catch (_: Throwable) {
    }
  }

  fun markPageFinished(url: String) {
    try {
      if (url == mainUrl) mainPageFinished.set(true)
    } catch (_: Throwable) {
    }
  }

  fun markError() {
    try {
      hadError.set(true)
    } catch (_: Throwable) {
    }
  }

  fun readLog(context: Context): String? {
    return try {
      val f = File(context.filesDir, LOG_NAME)
      if (f.exists()) f.readText().takeIf { it.isNotBlank() } else null
    } catch (_: Throwable) {
      null
    }
  }
}
