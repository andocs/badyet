package expo.modules.notificationlistener

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NotificationListenerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NotificationListener")

    Events("onNotification")

    OnStartObserving {
      NotificationBridge.sink = { payload -> sendEvent("onNotification", payload) }
    }
    OnStopObserving {
      NotificationBridge.sink = null
    }

    Function("isAccessGranted") {
      val ctx = appContext.reactContext ?: return@Function false
      NotificationManagerCompat.getEnabledListenerPackages(ctx).contains(ctx.packageName)
    }

    Function("openAccessSettings") {
      val ctx = appContext.reactContext ?: return@Function
      ctx.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }
  }
}
