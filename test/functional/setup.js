/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-env node, mocha */

// for unhandled promise rejection debugging
process.on("unhandledRejection", r => console.error(r)); // eslint-disable-line no-console

const utils = require("./utils");

const SETUP_DELAY = process.env.DELAY ? parseInt(process.env.DELAY) : 500;

const PREFS_TO_BE_CLEANED_UP = {
  [`${utils.PREF_BRANCH}.started`]: null,
  [`${utils.PREF_BRANCH}.dontShowChecked`]: null,
  [`${utils.PREF_BRANCH}.notificationCount`]: null,
  [`${utils.PREF_BRANCH}.lastNotification`]: null,
};

describe("setup", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(SETUP_DELAY * 20);

  let driver;

  // runs ONCE
  before(async () => {
    driver = await utils.setupWebdriver.promiseSetupDriver(
      utils.FIREFOX_PREFERENCES,
    );
  });

  after(() => {
    driver.quit();
  });

  describe("sets up the correct prefs, depending on the variation", () => {

    let addonId;

    describe("loads and sets the correct prefs for variation captive-portal", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "captive-portal");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("has the correct prefs after install and load", async () => {
        await utils.checkPrefs(driver, {
          [`${utils.PREF_BRANCH}.started`]: true,
          [`${utils.PREF_BRANCH}.variation`]: "captive-portal",
        });
      });

      it("has the correct prefs after uninstall", async () => {
        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
        await utils.checkPrefs(driver, PREFS_TO_BE_CLEANED_UP);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation`);
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName`);
      });
    });

    describe("loads and sets the correct prefs for variation streaming-hostname", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "streaming-hostname");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("has the correct prefs after install and load", async () => {
        await utils.checkPrefs(driver, {
          [`${utils.PREF_BRANCH}.started`]: true,
          [`${utils.PREF_BRANCH}.variation`]: "streaming-hostname",
        });
      });

      it("has the correct prefs after uninstall", async () => {
        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
        await utils.checkPrefs(driver, PREFS_TO_BE_CLEANED_UP);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation`);
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName`);
      });
    });

    describe("loads and sets the correct prefs for variation privacy-hostname", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "privacy-hostname");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("has the correct prefs after install and load", async () => {
        await utils.checkPrefs(driver, {
          [`${utils.PREF_BRANCH}.started`]: true,
          [`${utils.PREF_BRANCH}.variation`]: "privacy-hostname",
        });
      });

      it("has the correct prefs after uninstall", async () => {
        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
        await utils.checkPrefs(driver, PREFS_TO_BE_CLEANED_UP);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation`);
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName`);
      });
    });

    describe("loads and sets the correct prefs for variation catch-all", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "catch-all");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("has the correct prefs after install and load", async () => {
        await utils.checkPrefs(driver, {
          [`${utils.PREF_BRANCH}.started`]: true,
          [`${utils.PREF_BRANCH}.variation`]: "catch-all",
        });
      });

      it("has the correct prefs after uninstall", async () => {
        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
        await utils.checkPrefs(driver, PREFS_TO_BE_CLEANED_UP);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation`);
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName`);
      });
    });

    describe("loads and sets the correct prefs for variation control", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "control");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("has the correct prefs after install and load", async () => {
        await utils.checkPrefs(driver, {
          [`${utils.PREF_BRANCH}.started`]: true,
          [`${utils.PREF_BRANCH}.variation`]: "control",
        });
      });

      it("has the correct prefs after uninstall", async () => {
        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
        await utils.checkPrefs(driver, PREFS_TO_BE_CLEANED_UP);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation`);
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName`);
      });
    });

  });
});
