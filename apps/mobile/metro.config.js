const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Monorepo root — two levels up from apps/mobile
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Let Metro watch the entire monorepo so it can resolve packages
// hoisted to the root node_modules by pnpm
config.watchFolders = [monorepoRoot];

// Look in both the app's own node_modules AND the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
