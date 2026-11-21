package expo.modules.notificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
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
    NotificationBridge.sink?.invoke()
  }
}
