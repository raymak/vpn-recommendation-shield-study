/* eslint-env node */

const PREF_BRANCH = "extensions.vpn-recommendation-study-1_shield_mozilla_org";

const defaultConfig = {
  // Global options:
  sourceDir: "./src/",
  artifactsDir: "./dist/",
  ignoreFiles: [".DS_Store"],
  // Command options:
  build: {
    overwriteDest: true,
  },
  run: {
    firefox: process.env.FIREFOX_BINARY || "nightly",
    browserConsole: true,
    startUrl: ["about:debugging"],
    pref: [
      "shieldStudy.logLevel=All",
      `${PREF_BRANCH}.debug_mode=true`,
    ],
  },
};

module.exports = defaultConfig;
