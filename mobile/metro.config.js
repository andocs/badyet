const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Share the web app's pure TypeScript (lib/) with the phone. lib/ only imports other lib/ files
// through the "@/lib/*" alias set in tsconfig.json.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../lib')];

module.exports = config;
