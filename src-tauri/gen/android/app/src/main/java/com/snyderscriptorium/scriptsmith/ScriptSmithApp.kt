package com.snyderscriptorium.scriptsmith

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.os.Process
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Installs a global crash handler as early as possible so that a startup
 * crash shows the user the actual error instead of a bare "keeps stopping".
 */
class ScriptSmithApp : Application() {
  override fun onCreate() {
    super.onCreate()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      try {
        CrashReporter.writeCrashLog(this, thread, throwable)
      } catch (_: Exception) {
      }
      try {
        val intent = Intent(this, CrashReportActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(intent)
      } catch (_: Exception) {
      }
      // Give the activity manager a beat to launch the report screen, then die.
      // We deliberately do NOT chain to the previous handler: we show our own screen.
      try {
        Thread.sleep(1200)
      } catch (_: Exception) {
      }
      Process.killProcess(Process.myPid())
      System.exit(10)
    }
  }
}

object CrashReporter {
  fun buildReport(thread: Thread, throwable: Throwable): String {
    val sw = StringWriter()
    val pw = PrintWriter(sw)
    pw.println("ScriptSmith crash report")
    pw.println("Time: " + SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date()))
    pw.println("Thread: " + thread.name)
    pw.println()
    throwable.printStackTrace(pw) // includes full "Caused by:" chain
    pw.flush()
    return sw.toString()
  }

  fun logFile(context: Context): File {
    val ext = context.getExternalFilesDir(null)
    return if (ext != null) File(ext, "crash.log") else File(context.filesDir, "crash.log")
  }

  fun writeCrashLog(context: Context, thread: Thread, throwable: Throwable) {
    val report = buildReport(thread, throwable)
    try {
      val file = logFile(context)
      file.parentFile?.mkdirs()
      file.writeText(report)
    } catch (_: Exception) {
      try {
        File(context.filesDir, "crash.log").writeText(report)
      } catch (_: Exception) {
      }
    }
  }

  /** Used from inside an Activity catch block: write the log and show the report screen. */
  fun writeAndShow(activity: Activity, throwable: Throwable) {
    writeCrashLog(activity, Thread.currentThread(), throwable)
    val intent = Intent(activity, CrashReportActivity::class.java)
    activity.startActivity(intent)
  }
}
