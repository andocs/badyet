// Gives the phone's network client time limits and stops it reusing connections that went stale while the phone idled.
//
// React Native's own network client has NO timeouts by default (connect, read and write are all 0), and it keeps idle connections for
// reuse. After the phone idles, the one connection to the server can die without the app being told; every request then waits on it
// for ever, which no JavaScript timeout can undo (cancelling a request does not close the connection). Only a restart of the app's
// process cleared it. This plugin adds a small Kotlin class and registers it when the app starts:
//   - connect, read and write timeouts, so a dead connection fails in seconds and the next request opens a fresh one;
//   - no idle connections kept (every request starts on a new connection), so a stale one is never picked up again;
//   - an HTTP/2 ping, so a connection that stops answering while a request is waiting on it is dropped.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainApplication } = require('expo/config-plugins');

const CLASS_NAME = 'KeepAliveOkHttpClientFactory';

const factorySource = (pkg) => `package ${pkg}

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import java.util.concurrent.TimeUnit
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient

/** The app's network client: React Native's own, plus time limits and no reuse of idle connections (see plugins/withNetworkKeepAlive.js). */
class ${CLASS_NAME} : OkHttpClientFactory {
  override fun createNewNetworkModuleClient(): OkHttpClient =
    OkHttpClientProvider.createClientBuilder()
      .connectTimeout(15, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .writeTimeout(30, TimeUnit.SECONDS)
      .connectionPool(ConnectionPool(0, 1, TimeUnit.SECONDS))
      .pingInterval(15, TimeUnit.SECONDS)
      .build()
}
`;

function withFactoryFile(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android && cfg.android.package;
      if (!pkg) throw new Error('withNetworkKeepAlive: set android.package in app.json');
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${CLASS_NAME}.kt`), factorySource(pkg));
      return cfg;
    },
  ]);
}

function withRegistration(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') throw new Error('withNetworkKeepAlive: MainApplication is not Kotlin; update the plugin');
    let src = cfg.modResults.contents;
    if (src.includes(CLASS_NAME)) return cfg;
    const importLine = 'import com.facebook.react.modules.network.OkHttpClientProvider';
    if (!src.includes(importLine)) src = src.replace(/^(package .*\n)/m, `$1\n${importLine}\n`);
    if (!/super\.onCreate\(\)/.test(src)) throw new Error('withNetworkKeepAlive: could not find super.onCreate() in MainApplication');
    src = src.replace(/super\.onCreate\(\)/, `super.onCreate()\n    OkHttpClientProvider.setOkHttpClientFactory(${CLASS_NAME}())`);
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = (config) => withRegistration(withFactoryFile(config));
