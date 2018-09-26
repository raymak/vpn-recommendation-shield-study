/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-env node, mocha */

const utils = require("./utils");
const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

const SETUP_DELAY = process.env.DELAY ? parseInt(process.env.DELAY) : 500;

describe("triggers", function() {
  this.timeout(32000);

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

  describe("check triggers for different variations", () => {
    let addonId;

    describe("triggers captive portal variation", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "captive-portal");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("shows recommendation within 10 seconds of captive portal being triggered", async () => {
        driver.setContext(Context.CHROME);
        await driver.executeScript(`
          Services.obs.notifyObservers(null, "captive-portal-login");
        `);
        await driver.sleep(12000);
        utils.isNotificationVisible(driver);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
      });
    });

    describe("triggers streaming hostname variation", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "streaming-hostname");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("shows recommendation when netflix.com is opened", async () => {
        driver.setContext(Context.CHROME);
        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://netflix.com");
          window.gBrowser.selectedTab = tab;
        `);

        await driver.sleep(SETUP_DELAY * 5);
        utils.isNotificationVisible(driver);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
      });
    });

    describe("triggers privacy hostname variation", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "privacy-hostname");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("shows recommendation when symantec.com is opened", async () => {
        driver.setContext(Context.CHROME);
        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://symantec.com");
          window.gBrowser.selectedTab = tab;
        `);

        await driver.sleep(SETUP_DELAY * 5);
        utils.isNotificationVisible(driver);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
      });
    });

    describe("checks that control does not show notifications", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "control");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("does not show show recommendation with any trigger", async () => {
        driver.setContext(Context.CHROME);
        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://symantec.com");
          window.gBrowser.selectedTab = tab;
        `);
        await driver.sleep(SETUP_DELAY * 5);
        utils.isNotificationVisible(driver, false);

        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://netflix.com");
          window.gBrowser.selectedTab = tab;
        `);

        await driver.sleep(SETUP_DELAY * 5);
        utils.isNotificationVisible(driver, false);

        await driver.executeScript(`
          Services.obs.notifyObservers(null, "captive-portal-login");
        `);
        await driver.sleep(12000);
        utils.isNotificationVisible(driver, false);
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
