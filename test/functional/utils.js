/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-env node, mocha */


// for unhandled promise rejection debugging
process.on("unhandledRejection", r => console.error(r)); // eslint-disable-line no-console

// The geckodriver package downloads and installs geckodriver for us.
// We use it by requiring it.
require("geckodriver");

const firefox = require("selenium-webdriver/firefox");
const Context = firefox.Context;
const {assert} = require("chai");

// Preferences set during testing
const FIREFOX_PREFERENCES = {
  // Ensure e10s is turned on.
  "browser.tabs.remote.autostart": true,
  "browser.tabs.remote.autostart.1": true,
  "browser.tabs.remote.autostart.2": true,

  // Improve debugging using `browser toolbox`.
  "devtools.chrome.enabled": true,
  "devtools.debugger.remote-enabled": true,
  "devtools.debugger.prompt-connection": false,

  // Removing warning for `about:config`
  "general.warnOnAboutConfig": false,

  // Force variation for testing
  // "extensions.fastblock_shield_mozilla_org.test.variationName": "0",

  // Enable verbose shield study utils logging
  "shieldStudy.logLevel": "All",

  /** WARNING: Geckodriver sets many additional prefs at:
   * https://dxr.mozilla.org/mozilla-central/source/testing/geckodriver/src/prefs.rs
   *
   * In, particular, this DISABLES actual telemetry uploading
   * ("toolkit.telemetry.server", Pref::new("https://%(server)s/dummy/telemetry/")),
   *
   */
};

const PANEL_ID = "vpn-recommender-doorhanger-panel";

const PREF_BRANCH = "extensions.vpn-recommendation-study-1_shield_mozilla_org";
const WIDGET_ID = "vpn-recommendation-study-1_shield_mozilla_org";

const CATCH_ALL_TRIGGER_TIMER_OVERRIDE_PREF = PREF_BRANCH + ".test.catchAllTimerMins";

// Re-usable test methods from shield-studies-addon-utils
const { executeJs } = require("shield-studies-addon-utils/testUtils/executeJs");
const { nav } = require("shield-studies-addon-utils/testUtils/nav");
const { setupWebdriver } = require("shield-studies-addon-utils/testUtils/setupWebdriver");
const { telemetry } = require("shield-studies-addon-utils/testUtils/telemetry");
const { ui } = require("shield-studies-addon-utils/testUtils/ui");

async function setPreference(driver, name, value) {
  if (typeof value === "string") {
    value = `"${value}"`;
  }

  driver.setContext(Context.CHROME);
  await driver.executeScript(`
    var Preferences = ChromeUtils.import("resource://gre/modules/Preferences.jsm", {}).Preferences;
    Preferences.set("${name}", ${value});
  `);
}

async function getPreference(driver, name) {
  driver.setContext(Context.CHROME);
  const value = await driver.executeScript(`
    let Preferences = ChromeUtils.import("resource://gre/modules/Preferences.jsm", {}).Preferences;
    return Preferences.get("${name}");
  `);
  return value;
}

async function clearPreference(driver, name) {
  driver.setContext(Context.CHROME);
  await driver.executeScript(`Services.prefs.clearUserPref("${name}");`);
}


async function checkPrefs(driver, prefs) {
  for (const pref in prefs) {
    const val = await getPreference(driver, pref);
    assert.equal(val, prefs[pref], `set the right pref for ${pref}`);
  }
}

async function isNotificationVisible(driver, value = true) {
  driver.setContext(Context.CHROME);
  const elem = await driver.executeScript(`
    return window.document.getElementById("${PANEL_ID}");
  `);

  assert.equal(Boolean(elem), value, "notification must be visible");
}

async function killNotification(driver) {
  // kills the notification by forcing auto-dismiss
  driver.setContext(Context.CHROME);
  await driver.executeScript(`
      const tab = window.gBrowser.addWebTab("http://mozilla.org");
      window.gBrowser.selectedTab = tab;
    `);
}

module.exports = {
  FIREFOX_PREFERENCES,
  PREF_BRANCH,
  CATCH_ALL_TRIGGER_TIMER_OVERRIDE_PREF,
  WIDGET_ID,
  setPreference,
  getPreference,
  clearPreference,
  checkPrefs,
  setupWebdriver,
  nav,
  telemetry,
  executeJs,
  ui,
  isNotificationVisible,
  killNotification,
};
