/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/* global ExtensionAPI, ExtensionCommon, Preferences, PrivateBrowsingUtils */

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

Cu.importGlobalProperties(["XMLHttpRequest", "URL", "URLSearchParams"]);

XPCOMUtils.defineLazyModuleGetters(this, {
  Preferences: "resource://gre/modules/Preferences.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
  setInterval: "resource://gre/modules/Timer.jsm",
  clearInterval: "resource://gre/modules/Timer.jsm",
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  AddonManager: "resource://gre/modules/AddonManager.jsm",
});

const PREF_BRANCH = "extensions.vpn-recommendation-study-1_shield_mozilla_org";
const DONT_SHOW_PREF = PREF_BRANCH + ".dontShowChecked";
const NOTIFICATION_COUNT_PREF = PREF_BRANCH + ".notificationCount";
const LAST_NOTIFICATION_PREF = PREF_BRANCH + ".lastNotification";
const DEBUG_MODE_PREF = PREF_BRANCH + ".debug_mode";
const TEST_PREF = PREF_BRANCH + ".started";
const VARIATION_PREF = PREF_BRANCH + ".variation";

// triggers should match branch (variation) names
const TRIGGERS = {
  CAPTIVE_PORTAL: "captive-portal",
  PRIVACY_HOSTNAME: "privacy-hostname",
  STREAMING_HOSTNAME: "streaming-hostname",
  CATCH_ALL: "catch-all",
};

const CATCH_ALL_TRIGGER_TIMER_OVERRIDE_PREF = PREF_BRANCH + ".test.catchAllTimerMins";

const CP_SUCCESS_XHR_TIMEOUT = 3000;
const CAPTIVE_PORTAL_URL = "http://detectportal.firefox.com/success.txt";
const CP_SUCCESS_CHECK_INTERVAL = 10000;
const CP_SUCCESS_MAX_CHECK_COUNT = 12;

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

const CATCH_ALL_TRIGGER_TIMER_MINUTES = 10;
const MAX_NOTIFICATION_COUNT = 3;

const VPN_LANDING_PAGE_URL = "https://premium.firefox.com/vpn/";
const VPN_LANDING_PAGE_DEFAULT_PARAMS = {
  "utm_source": "firefox-browser",
  "utm_medium": "firefox-browser",
  "utm_campaign": "shield_vpn_1",
};

const log = function(...args) {
  if (!Preferences.get(DEBUG_MODE_PREF)) return;
  console.log(...args);
};

const DOORHANGER_MESSAGES = {
  "captive-portal": {
    header: "It appears you are browsing on an unsecured wireless network.",
    text: "Firefox has teamed up with ProtonVPN to provide you with a private and secure internet connection, no matter where you are.",
  },
  "privacy-hostname": {
    header: "Make Firefox even more secure with ProtonVPN.",
    text: "Firefox has teamed up with ProtonVPN to provide you with a private and secure internet connection, no matter where you are.",
  },
  "streaming-hostname": {
    header: "Make Firefox even more secure with ProtonVPN.",
    text: "Firefox has teamed up with ProtonVPN to provide you with a private and secure internet connection, no matter where you are.",
  },
  "catch-all": {
    header: "Make Firefox even more secure with ProtonVPN.",
    text: "Firefox has teamed up with ProtonVPN to provide you with a private and secure internet connection, no matter where you are.",
  },
};

this.vpnRecommender = class extends ExtensionAPI {

  getAPI(context) {
    const that = this;

    const jsms = {}; // workaround for not being able to use jsms with moz:// urls

    Services.scriptloader.loadSubScript(context.extension.getURL("privileged/vpnRecommender/Doorhanger.jsm"), jsms);
    Services.scriptloader.loadSubScript(context.extension.getURL("privileged/vpnRecommender/VpnRelatedHostnames.jsm"), jsms);
    Services.scriptloader.loadSubScript(context.extension.getURL("privileged/vpnRecommender/RecentWindow.jsm"), jsms);
    Services.scriptloader.loadSubScript(context.extension.getURL("privileged/vpnRecommender/EveryWindow.jsm"), jsms);

    this.Doorhanger = jsms.Doorhanger;
    this.VpnRelatedHostnames = jsms.VpnRelatedHostnames;
    this.RecentWindow = jsms.RecentWindow;
    this.EveryWindow = jsms.EveryWindow;

    this.addCleanUpFunction(() => {
      Cu.unload(context.extension.getURL("privileged/vpnRecommender/Doorhanger.jsm"));
      Cu.unload(context.extension.getURL("privileged/vpnRecommender/VpnRelatedHostnames.jsm"));
      Cu.unload(context.extension.getURL("privileged/vpnRecommender/RecentWindow.jsm"));
      Cu.unload(context.extension.getURL("privileged/vpnRecommender/EveryWindow.jsm"));
    });

    this.extensionUrl = context.extension.getURL();

    const EventManager = ExtensionCommon.EventManager;

    this.listenForAddonDisableOrUninstall(context.extension.id); // https://github.com/mozilla/shield-studies-addon-utils/issues/247

    AddonManager.addAddonListener(this);
    return {
      experiments: {
        vpnRecommender: {
          start(variation, isFirstRun) {
            that.start(variation, isFirstRun);
          },

          onSendTelemetry: new EventManager(context, "vpnRecommender.onSendTelemetry", fire => {
            that.setTelemetryCallback((data) => fire.async(data));
            return () => {};
          }).api(),

          fakeCaptivePortal() {
            Services.obs.notifyObservers(null, "captive-portal-login");
          },

          cleanUp() {
            that.cleanUp();
          },
        },
      },
    };
  }

  start(variation, isFirstRun) {
    log("starting", `variation: ${variation}`);
    this.variation = variation;

    this.registerListeners();

    if (isFirstRun) {
      this.sendTelemetry({
        "message_type": "event",
        "event": "study-start",
      });
    }

    Preferences.set(TEST_PREF, true);
    Preferences.set(VARIATION_PREF, variation);
  }

  async waitForConnection() {
    const checkConnection = async () => {
      const p = new Promise((resolve, error) => {
        const xhr = new XMLHttpRequest();

        xhr.timeout = CP_SUCCESS_XHR_TIMEOUT;

        xhr.addEventListener("load", () => {
          log("CP connection check load");

          if (xhr.response === "success\n") {
            log("CP connection check success");
            resolve("success");
          }
          resolve("failure");
        });

        xhr.addEventListener("error", () => {
          log("CP connection check error");
          resolve("failure");
        });

        xhr.addEventListener("timeout", () => {
          log("CP connection check timeout");
          resolve("failue");
        });

        xhr.open("GET", CAPTIVE_PORTAL_URL);
        xhr.send();
      });

      return p;
    };

    let tiCount = 0;

    const promise = new Promise((resolve, error) => {
      const ti = setInterval(async () => {
        const res = await checkConnection();
        if (res === "success") {
          resolve({success: true, tiCount});
          clearInterval(ti);
        }
        tiCount += 1;

        if (tiCount === CP_SUCCESS_MAX_CHECK_COUNT) {
          clearInterval(ti);

          resolve({success: false, tiCount});
        }

      }, CP_SUCCESS_CHECK_INTERVAL);
    });

    return promise;
  }

  listenForAddonDisableOrUninstall(addonId) {
    let handleDisableOrUninstall;

    const listener = {
      onUninstalling(addon) {
        handleDisableOrUninstall(addon);
      },
      onDisabled(addon) {
        handleDisableOrUninstall(addon);
      },
    };

    handleDisableOrUninstall = (addon) => {
      if (addon.id !== addonId) {
        return;
      }

      AddonManager.removeAddonListener(listener);

      this.cleanUp();
      addon.uninstall();
    };

    AddonManager.addAddonListener(listener);
  }

  registerListeners() {
    log("registering listeners");

    this.registerCaptivePortalTrigger();
    this.registerPrivacyHostnameTrigger();
    this.registerCatchallTrigger();
    this.registerStreamingHostnameTrigger();
  }

  registerCaptivePortalTrigger() {
    const that = this;

    const observer = () => {
      if (that._isWaitingForConnection) return; // only one connection check at a time

      that.waitForConnection().then((result) => {
        that.sendTelemetry({
          "message_type": "captive_portal_connection_check",
          "success": String(result.success),
          "time": String((result.tiCount + 1) * CP_SUCCESS_CHECK_INTERVAL),
        });

        if (result.success) that.tryShowNotification(TRIGGERS.CAPTIVE_PORTAL);
        that._isWaitingForConnection = false;
      });

      that._isWaitingForConnection = true;
    };

    Services.obs.addObserver(observer, "captive-portal-login");
    that.addCleanUpFunction(() => {
      Services.obs.removeObserver(observer, "captive-portal-login");
    });
  }

  registerHostnameTrigger(hostnameList, trigger) {
    log("registering hostname trigger");

    const that = this;

    const progressListener = {
      QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener",
        "nsISupportsWeakReference"]),

      onStateChange(webProgress, request, flag, status) {
      },

      onLocationChange(progress, request, uri) {
        // This fires when the location bar changes; that is load event is confirmed
        // or when the user switches tabs. If you use myListener for more than one tab/window,
        // use progress.DOMWindow to obtain the tab/window which triggered the change.

        try {
          const hostname = uri.host;

          const test_function = (ref_hostname) => {
            return Services.eTLD.hasRootDomain(hostname, ref_hostname);
          };

          if (hostnameList.some(test_function)) {
            that.tryShowNotification(trigger);
          }

        } catch (e) {

        }
      },
    };

    const windowInit = (win) => {
      win.gBrowser.addProgressListener(progressListener);
    };

    const windowUninit = (win) => {
      win.gBrowser.removeProgressListener(progressListener);
    };

    this.EveryWindow.registerCallback(trigger, windowInit, windowUninit);
    this.addCleanUpFunction(() => {
      this.EveryWindow.unregisterCallback(trigger);
    });
  }

  registerPrivacyHostnameTrigger() {
    this.registerHostnameTrigger(this.VpnRelatedHostnames.PRIVACY_PROVIDER_HOSTNAMES,
      TRIGGERS.PRIVACY_HOSTNAME);
  }

  registerCatchallTrigger() {
    log("registering catch-all trigger");
    setTimeout(() => {
      this.tryShowNotification(TRIGGERS.CATCH_ALL);
    }, Preferences.get(CATCH_ALL_TRIGGER_TIMER_OVERRIDE_PREF) * 60 * 1000 ||
      CATCH_ALL_TRIGGER_TIMER_MINUTES * 60 * 1000
    );
  }

  registerStreamingHostnameTrigger() {
    this.registerHostnameTrigger(this.VpnRelatedHostnames.STREAMING_HOSTNAMES,
      TRIGGERS.STREAMING_HOSTNAME);
  }

  setTelemetryCallback(callback) {
    this.telemetryCallback = callback; // TOFIX: as of now only sends data back to the last registered event listener
  }

  sendTelemetry(data) {
    if (this.telemetryCallback) {
      this.telemetryCallback(data);
    }
  }

  dontShowChange(checked) {
    Preferences.set(DONT_SHOW_PREF, checked);
    this.notificationResultData.dontShowChecked = checked;

    this.telemetryCallback({
      "message_type": "dont_show_change_event",
      "checked": String(checked),
    });
  }

  openVpnPage() {
    const variation = this.variation;
    const urlArgs = Object.assign({}, VPN_LANDING_PAGE_DEFAULT_PARAMS,
      {"utm_content": variation});

    const mergeQueryArgs = (url, ...args) => {
      /* currently left to right*/
      const U = new URL(url);
      let q = U.search || "?";
      q = new URLSearchParams(q);

      const merged = Object.assign({}, ...args);

      // get user info.
      Object.keys(merged).forEach((k) => {
        q.set(k, merged[k]);
      });

      U.search = q.toString();
      return U.toString();
    };

    const win = this.RecentWindow.getMostRecentBrowserWindow();
    const tab = win.gBrowser.addWebTab(mergeQueryArgs(VPN_LANDING_PAGE_URL, urlArgs));
    win.gBrowser.selectedTab = tab;
  }

  notificationActionCallback(message) {
    log(`notification action: name => ${message.name}, data=> ${JSON.stringify(message.data)}`);

    let eventName;

    if (message.name === "VpnRecommender::action") {
      eventName = "action";
      this.openVpnPage();
      this.concludeNotification("action");
    }

    if (message.name === "VpnRecommender::dismiss") {
      eventName = "dismiss";
      this.concludeNotification("dismiss");
    }

    if (message.name === "VpnRecommender::info") {
      eventName = "info";
    }

    if (message.name === "VpnRecommender::autoDismiss") {
      eventName = "auto-dismiss";
      this.concludeNotification("auto-dismiss");
      this.sendTelemetry({
        "message_type": "auto_dismissal_event",
        "reason": message.data.reason,
      });
    }

    if (message.name === "VpnRecommender::dontShowChange") {
      eventName = "dont-show-change";
      this.dontShowChange(message.data.checked);
    }

    this.telemetryCallback({
      "message_type": "event",
      "event": eventName,
    });
  }

  getTriggerData(trigger, pref) {
    const str_val = Preferences.get(pref);
    if (!str_val) { // pref does not exist
      return str_val;
    }

    const val = JSON.parse(str_val);
    return val[trigger];
  }

  setTriggerData(trigger, pref, value) {
    let str_val = Preferences.get(pref);
    if (!str_val) {
      str_val = "{}";
    }

    const obj_val = JSON.parse(str_val);
    obj_val[trigger] = value;
    Preferences.set(pref, JSON.stringify(obj_val));
  }

  tryShowNotification(trigger) {
    const isShadow = (trigger !== this.variation);

    this.sendTelemetry({
      "message_type": "event",
      "event": "trigger",
      "trigger": trigger,
      "is-shadow": String(isShadow),
    });

    if (Date.now() - Number(this.getTriggerData(trigger, LAST_NOTIFICATION_PREF)) < TWENTY_FOUR_HOURS) {
      log("less than 24 hours has passed since the last notification was shown");
      return;
    }

    const notificationCount = this.getTriggerData(trigger, NOTIFICATION_COUNT_PREF) || 0;
    if (notificationCount === MAX_NOTIFICATION_COUNT) return;

    if (!this.RecentWindow.getMostRecentBrowserWindow()) {
      return; // if all windows are private
    }

    // this condition ensures that the doorhanger is actually shown (not a shadow notification) only when the trigger and the branch match
    if (!isShadow && !Preferences.get(DONT_SHOW_PREF)) {
      this.showNotification();

      this.notificationResultData = {
        dontShowChecked: false,
        notificationNumber: notificationCount + 1,
        result: "unknown",
      };

      this.sendTelemetry({
        "message_type": "event",
        "event": "notification-delivered",
        "number": String(notificationCount + 1),
      });
    }

    this.setTriggerData(trigger, NOTIFICATION_COUNT_PREF, notificationCount + 1); // increment notification count
    this.setTriggerData(trigger, LAST_NOTIFICATION_PREF, String(Date.now()));

    this.sendTelemetry({
      "message_type": "event",
      "event": "shadow-notification",
      "number": String(notificationCount + 1),
      "trigger": trigger,
      "is-shadow": String(isShadow),
    });
  }

  reportNotificationResult() {
    if (!this.notificationResultData) return;

    const data = this.notificationResultData;

    this.sendTelemetry({
      "message_type": "notification_result",
      "number": String(data.notificationNumber),
      "dont-show-checked": String(data.dontShowChecked),
      "result": data.result,
    });

    this.notificationResultData = undefined; // to be able to call this function multiple times safely
  }

  concludeNotification(result) {
    this.notificationResultData.result = result;
    this.reportNotificationResult();
  }

  showNotification() {
    const doorhanger = new this.Doorhanger(this.notificationActionCallback.bind(this), `${this.extensionUrl}privileged/vpnRecommender`);
    doorhanger.present({message: DOORHANGER_MESSAGES[this.variation]});

    this.addCleanUpFunction(() => {
      doorhanger.destruct();
    });
  }

  addCleanUpFunction(func) {
    if (!this.cleanUpFunctions) {
      this.cleanUpFunctions = [];
    }

    this.cleanUpFunctions.unshift(func); // the most recent function gets called first
  }

  cleanUp() {
    log("cleaning up VPN Recommender");

    if (this.cleanUpFunctions) {
      for (const f of this.cleanUpFunctions) {
        try {
          f();
        } catch (e) {

        }
      }
    }

    // clean up prefs
    Preferences.reset(DONT_SHOW_PREF);
    Preferences.reset(NOTIFICATION_COUNT_PREF);
    Preferences.reset(LAST_NOTIFICATION_PREF);
    Preferences.reset(TEST_PREF);
  }
};
