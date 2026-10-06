// Monorepo npm workspaces : Expo configure automatiquement watchFolders/nodeModulesPaths (SDK 52+).
const { getDefaultConfig } = require("expo/metro-config");
module.exports = getDefaultConfig(__dirname);
