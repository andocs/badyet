package expo.modules.notificationlistener

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Runs the JS "CaptureHeadless" task with no screen, so a notification that arrives while the app is closed is read,
 * understood and sent right away. The task is registered in src/lib/backgroundCapture.ts.
 */
class CaptureHeadlessService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? =
    HeadlessJsTaskConfig("CaptureHeadless", Arguments.createMap(), 60_000L, true)
}
