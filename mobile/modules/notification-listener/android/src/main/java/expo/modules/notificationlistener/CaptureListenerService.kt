package expo.modules.notificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** Hands the JS side only what the parsers need. Nothing is written to disk here. */
object NotificationBridge {
  @Volatile
  var sink: ((Map<String, Any?>) -> Unit)? = null
}

class CaptureListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val extras = sbn.notification.extras
    NotificationBridge.sink?.invoke(
      mapOf(
        "package" to sbn.packageName,
        "title" to extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
        "text" to extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
        "bigText" to extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
        "postTime" to sbn.postTime.toDouble()
      )
    )
  }
}
