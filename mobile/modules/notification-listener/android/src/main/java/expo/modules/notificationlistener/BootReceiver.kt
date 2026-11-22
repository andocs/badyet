package expo.modules.notificationlistener

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import com.facebook.react.HeadlessJsTaskService

/**
 * After a reboot: asks Android to reconnect the notification listener, then runs one capture so the 15 minute background task is
 * registered again and anything missed while the phone was off is looked at (Gmail is checked right away). If Android refuses,
 * the next app open does the same.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    val ctx = context.applicationContext
    try {
      NotificationListenerService.requestRebind(ComponentName(ctx, CaptureListenerService::class.java))
    } catch (e: Exception) {
      // Listener access not granted: nothing to reconnect.
    }
    try {
      ctx.startService(Intent(ctx, CaptureHeadlessService::class.java))
      HeadlessJsTaskService.acquireWakeLockNow(ctx)
    } catch (e: Exception) {
      // Not allowed to start a service right now.
    }
  }
}
