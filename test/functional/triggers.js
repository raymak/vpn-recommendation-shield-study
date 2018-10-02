/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-env node, mocha */

/* This suit of tests verifies that the recommendation is triggered (or not triggered) correctly in each branch
 */


// for unhandled promise rejection debugging
process.on("unhandledRejection", r => console.error(r)); // eslint-disable-line no-console

const utils = require("./utils");
const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;

const SETUP_DELAY = process.env.DELAY ? parseInt(process.env.DELAY) : 500;

describe("triggers", function() {
  this.timeout(120000);

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

    describe("triggers the captive portal in the captive portal variation", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "captive-portal");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("shows the recommendation within 10 seconds of the captive portal notification being triggered", async () => {
        driver.setContext(Context.CHROME);
        await driver.executeScript(`
          Services.obs.notifyObservers(null, "captive-portal-login");
        `);
        await driver.sleep(12000);
        await utils.isNotificationVisible(driver);
      });

      it("does not show the recommendation again immediately after the first recommendation", async () => {
        driver.setContext(Context.CHROME);

        utils.killNotification(driver);
        driver.sleep(SETUP_DELAY);
        await driver.executeScript(`
          Services.obs.notifyObservers(null, "captive-portal-login");
        `);
        await driver.sleep(12000);
        await utils.isNotificationVisible(driver, false);
      });


      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
      });
    });

    describe("triggers the recommendaton in the streaming hostname variation", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "streaming-hostname");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("shows the recommendation when netflix.com is opened", async () => {
        driver.setContext(Context.CHROME);
        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://netflix.com");
          window.gBrowser.selectedTab = tab;
        `);

        await driver.sleep(SETUP_DELAY * 5);
        await utils.isNotificationVisible(driver);
      });

      it("does not show the recommendation again immediately after the first recommendation", async () => {
        driver.setContext(Context.CHROME);

        utils.killNotification(driver);
        driver.sleep(SETUP_DELAY);
        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://netflix.com");
          window.gBrowser.selectedTab = tab;
        `);

        await driver.sleep(SETUP_DELAY * 5);
        await utils.isNotificationVisible(driver, false);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
      });
    });

    describe("triggers the recommendation in the privacy hostname variation", () => {
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
        await utils.isNotificationVisible(driver);
      });

      it("does not show the recommendation again immediately after the first recommendation", async () => {
        driver.setContext(Context.CHROME);

        utils.killNotification(driver);
        driver.sleep(SETUP_DELAY);
        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://symantec.com");
          window.gBrowser.selectedTab = tab;
        `);

        await driver.sleep(SETUP_DELAY * 5);
        await utils.isNotificationVisible(driver, false);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
      });
    });

    describe("triggers the recommendation in the catch-all variation", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "catch-all");
        await utils.setPreference(driver, utils.CATCH_ALL_TRIGGER_TIMER_OVERRIDE_PREF, 1);
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("shows recommendation after 1 minute", async () => {
        await driver.sleep(1 * 60 * 1000 + SETUP_DELAY * 5);
        await utils.isNotificationVisible(driver);
      });

      after(async () => {
        await utils.clearPreference(driver, utils.CATCH_ALL_TRIGGER_TIMER_OVERRIDE_PREF);
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
      });
    });

    describe("checks that the control variation does not show any notifications", () => {
      before(async () => {
        await utils.setPreference(driver, `${utils.PREF_BRANCH}.test.variationName`, "control");
        addonId = await utils.setupWebdriver.installAddon(driver);
        await driver.sleep(SETUP_DELAY);
      });

      it("does not show show the recommendation with any trigger", async () => {
        driver.setContext(Context.CHROME);
        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://symantec.com");
          window.gBrowser.selectedTab = tab;
        `);
        await driver.sleep(SETUP_DELAY * 5);
        await utils.isNotificationVisible(driver, false);

        await driver.executeScript(`
          const tab = window.gBrowser.addWebTab("http://netflix.com");
          window.gBrowser.selectedTab = tab;
        `);

        await driver.sleep(SETUP_DELAY * 5);
        await utils.isNotificationVisible(driver, false);

        await driver.executeScript(`
          Services.obs.notifyObservers(null, "captive-portal-login");
        `);
        await driver.sleep(12000);
        await utils.isNotificationVisible(driver, false);
      });

      after(async () => {
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.test.variationName` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.started` );
        await utils.clearPreference(driver, `${utils.PREF_BRANCH}.variation` );

        await utils.setupWebdriver.uninstallAddon(driver, addonId);
        await driver.sleep(SETUP_DELAY);
      });
    });
  });
});
