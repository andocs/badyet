package expo.modules.notificationlistener

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Small on-device queue so a notification is not lost when the app is not running.
 * The service appends allowlisted notifications; JS drains and clears them after parsing.
 * Raw text lives here only until parsed, and never leaves the phone.
 */
object CaptureStore {
  private const val PREFS = "badyet_capture"
  private const val MAX_QUEUE = 500
  private const val MAX_SEEN = 200

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun allowed(ctx: Context): Set<String> =
    HashSet(prefs(ctx).getStringSet("allowed", emptySet()) ?: emptySet<String>())

  fun setAllowed(ctx: Context, packages: Collection<String>) {
    prefs(ctx).edit().putStringSet("allowed", HashSet(packages)).apply()
  }

  @Synchronized
  fun push(ctx: Context, item: JSONObject) {
    val old = JSONArray(prefs(ctx).getString("queue", "[]") ?: "[]")
    val next = JSONArray()
    val start = if (old.length() >= MAX_QUEUE) old.length() - MAX_QUEUE + 1 else 0
    for (i in start until old.length()) next.put(old.get(i))
    next.put(item)
    prefs(ctx).edit().putString("queue", next.toString()).apply()
  }

  @Synchronized
  fun drain(ctx: Context): String {
    val queued = prefs(ctx).getString("queue", "[]") ?: "[]"
    prefs(ctx).edit().putString("queue", "[]").apply()
    return queued
  }

  /** Package names only (never text), so the user can see which apps post notifications. */
  @Synchronized
  fun markSeen(ctx: Context, pkg: String) {
    val seen = HashSet(prefs(ctx).getStringSet("seen", emptySet()) ?: emptySet<String>())
    if (seen.size < MAX_SEEN && seen.add(pkg)) {
      prefs(ctx).edit().putStringSet("seen", seen).apply()
    }
  }

  fun seen(ctx: Context): List<String> = allowedSorted(prefs(ctx).getStringSet("seen", emptySet()))

  private fun allowedSorted(s: Set<String>?): List<String> = (s ?: emptySet()).sorted()
}
