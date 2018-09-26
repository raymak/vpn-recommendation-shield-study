/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-env node, mocha */

const utils = require("./utils");

const SETUP_DELAY = process.env.DELAY ? parseInt(process.env.DELAY) : 500;

describe("setup", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(SETUP_DELAY * 15);

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

  describe("sets up the correct prefs, depending on the variation", function() {

    let addonId;

    describe("loads and sets the correct prefs for variation captive-portal", function() {
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

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
      });
    });

    describe("loads and sets the correct prefs for variation streaming-hostname", function() {
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

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
      });
    });

    describe("loads and sets the correct prefs for variation privacy-hostname", function() {
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

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
      });
    });

    describe("loads and sets the correct prefs for variation catch-all", function() {
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

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
      });
    });

    describe("loads and sets the correct prefs for variation control", function() {
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

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
      });
    });

  });
});
