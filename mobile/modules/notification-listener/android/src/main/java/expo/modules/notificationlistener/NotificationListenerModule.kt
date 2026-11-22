package expo.modules.notificationlistener

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
  private fun appCtx(): Context =
    appContext.reactContext ?: throw IllegalStateException("React context is not available")

  override fun definition() = ModuleDefinition {
    Name("NotificationListener")

    Events("onQueued")

    OnStartObserving {
      NotificationBridge.sink = { sendEvent("onQueued", emptyMap<String, Any?>()) }
    }
    OnStopObserving {
      NotificationBridge.sink = null
    }

    Function("isAccessGranted") {
      val ctx = appCtx()
      NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)
    }

    Function("openAccessSettings") {
      appCtx().startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
      null
    }

    Function("setAllowedPackages") { packages: List<String> ->
      CaptureStore.setAllowed(appCtx(), packages)
      null
    }

    Function("drain") {
      CaptureStore.drain(appCtx())
    }

    Function("seenPackages") {
      CaptureStore.seen(appCtx())
    }

    // Launchable apps (the ones with an icon in the launcher), sorted by label.
    Function("installedApps") {
      val pm = appCtx().packageManager
      pm.getInstalledApplications(0)
        .filter { pm.getLaunchIntentForPackage(it.packageName) != null }
        .map { mapOf("package" to it.packageName, "label" to it.loadLabel(pm).toString()) }
        .sortedBy { (it["label"] ?: "").lowercase() }
    }
  }
}
