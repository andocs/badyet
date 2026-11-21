package expo.modules.notificationlistener

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.facebook.react.HeadlessJsTaskService
import org.json.JSONObject

/** Tells the JS side (when it is running) that the queue has something new. */
object NotificationBridge {
  @Volatile
  var sink: (() -> Unit)? = null
}

class CaptureListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val ctx = applicationContext
    val pkg = sbn.packageName ?: return
    CaptureStore.markSeen(ctx, pkg)
    if (!CaptureStore.allowed(ctx).contains(pkg)) return

    val extras = sbn.notification.extras
    val item = JSONObject()
    item.put("package", pkg)
    item.put("title", extras.getCharSequence(Notification.EXTRA_TITLE)?.toString())
    item.put("text", extras.getCharSequence(Notification.EXTRA_TEXT)?.toString())
    item.put("bigText", extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString())
    item.put("postTime", sbn.postTime)
    CaptureStore.push(ctx, item)

    val sink = NotificationBridge.sink
    if (sink != null) sink.invoke() else startHeadless(ctx)
  }

  /** The app has no JS running: start the headless capture task. If Android refuses, the queue is still safe and the 15 minute task or the next app open picks it up. */
  private fun startHeadless(ctx: Context) {
    try {
      ctx.startService(Intent(ctx, CaptureHeadlessService::class.java))
      HeadlessJsTaskService.acquireWakeLockNow(ctx)
    } catch (e: Exception) {
      // Not allowed to start a service from the background right now.
    }
  }
}
