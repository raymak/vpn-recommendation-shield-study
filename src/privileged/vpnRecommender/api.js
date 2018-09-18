/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

/* global ExtensionAPI, ExtensionCommon */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Preferences.jsm");
Cu.import("resource://gre/modules/Timer.jsm");
Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

const PREF_BRANCH = "extensions.vpn-recommendation-study-1_shield_mozilla_org";
const DONT_SHOW_PREF = PREF_BRANCH + ".dontShowChecked";
const NOTIFICATION_COUNT_PREF = PREF_BRANCH + ".notificationCount";
const DEBUG_MODE_PREF = PREF_BRANCH + ".debug_mode";

const CATCH_ALL_TRIGGER_TIMER_MINUTES = 10;
const MAX_NOTIFICATION_COUNT = 3;

const log = function(...args) {
  if (!Preferences.get(DEBUG_MODE_PREF)) return;
  console.log(...args);
};

const DOORHANGER_MESSAGES = {
  "captive-portal": {
    header: "It appears you are browsing on an unsecured wireless network.",
    text: "Firefox has teamed up with ProtonVPN to provide you with a private and secure internet connect, no matter where you are.",
  },
  "privacy-hostname": {
    header: "Looking for a Virtual Private Network service?",
    text: "Firefox has teamed up with ProtonVPN to provide you with a private and secure internet connect, no matter where you are.",
  },
  "streaming-hostname": {
    header: "Make Firefox more secure with ProtonVPN.",
    text: "Firefox has teamed up with ProtonVPN to provide you with a private and secure internet connect, no matter where you are.",
  },
  "catch-all": {
    header: "Make Firefox more secure with ProtonVPN.",
    text: "Firefox has teamed up with ProtonVPN to provide you with a private and secure internet connect, no matter where you are.",
  },
};

this.vpnRecommender = class extends ExtensionAPI {

  getAPI(context) {
    const that = this;

    Cu.import(context.extension.getURL("privileged/vpnRecommender/Doorhanger.jsm"), this);
    Cu.import(context.extension.getURL("privileged/vpnRecommender/VpnRelatedHostnames.jsm"), this);

    this.cleanUpFunctions = [];

    this.addCleanUpFunction(() => {
      Cu.unload(context.extension.getURL("privileged/vpnRecommender/Doorhanger.jsm"));
      Cu.unload(context.extension.getURL("privileged/vpnRecommender/VpnRelatedHostnames.jsm"));
      Cu.unload(context.extension.getURL("privileged/vpnRecommender/RecentWindow.jsm"));

      that.killNotification();
    });

    log("importing Doorhanger done");
    this.extensionUrl = context.extension.getURL();

    const EventManager = ExtensionCommon.EventManager;

    return {
      experiments: {
        vpnRecommender: {
          echo(str) {
            log(`echoing: ${str}`);
          },

          start(variation, isFirstRun) {
            that.start(variation, isFirstRun);
          },

          getInternals() {
            return that.getInternals();
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
  }

  registerListeners() {
    log("registering listeners");

    const variation = this.variation;

    if (variation === "captive-portal") {
      log("registering captive-portal detection");
      this.registerCaptivePortalTrigger();
    }

    if (variation === "privacy-hostname") {
      this.registerPrivacyHostnameTrigger();
    }

    if (variation === "control") { return; }

    if (variation === "catch-all") {
      this.registerCatchallTrigger();
    }

    if (variation === "streaming-hostname") {
      this.registerStreamingHostnameTrigger();
    }
  }

  registerCaptivePortalTrigger() {
    const that = this;

    const cpObserver = {
      observe(subject, topic, data) {
        if (topic !== "captive-portal-login") return;
        log("captive-portal-login");
        that.tryShowNotification();
      },
    };

    Services.obs.addObserver(cpObserver, "captive-portal-login");
    this.addCleanUpFunction(() => {
      Services.obs.removeObserver(cpObserver, "captive-portal-login");
    });
  }

  registerHostnameTrigger(hostnameList) {
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
            const escaped_ref_hostname = ref_hostname.replace(".", "\\.").replace("-", "\\-");
            const rx = new RegExp("^(.+\\.)*(" + escaped_ref_hostname + ")$");

            return rx.test(hostname);
          };

          if (hostnameList.some(test_function)) {
            that.tryShowNotification();
          }

        } catch (e) {

        }
      },
    };

    // current windows
    const windowEnumerator = Services.wm.getEnumerator("navigator:browser");

    while (windowEnumerator.hasMoreElements()) {
      const window = windowEnumerator.getNext();

      if (PrivateBrowsingUtils.isWindowPrivate(window)) continue; // ignore private windows

      const winWeak = Cu.getWeakReference(window);

      const onOpenWindow = function(e) {
        winWeak.get().gBrowser.addProgressListener(progressListener);
        winWeak.get().removeEventListener("load", onOpenWindow);
      };

      if (winWeak.get().gBrowser) {
        winWeak.get().gBrowser.addProgressListener(progressListener);
        that.addCleanUpFunction(() => {
          if (winWeak.get()) {
            winWeak.get().gBrowser.removeEventListener(progressListener);
          }
        });
      } else {
        winWeak.get().addEventListener("load", onOpenWindow, true);
      }
    }

    // new windows
    const windowListener = {
      onWindowTitleChange() { },
      onOpenWindow(xulWindow) {
        // xulWindow is of type nsIXULWindow, we want an nsIDOMWindow
        // see https://dxr.mozilla.org/mozilla-central/rev/53477d584130945864c4491632f88da437353356/browser/base/content/test/general/browser_fullscreen-window-open.js#316
        // for how to change XUL into DOM
        const window = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
          .getInterface(Ci.nsIDOMWindow);

        if (PrivateBrowsingUtils.isWindowPrivate(window)) return; // ignore private windows

        const winWeak = Cu.getWeakReference(window);

        // we need to use a listener function so that it's injected
        // once the window is loaded / ready
        const onWindowOpen = () => {
          winWeak.get().removeEventListener("load", onWindowOpen);

          if (winWeak.get().document.documentElement.getAttribute("windowtype") !== "navigator:browser") return;

          // add progress listener
          winWeak.get().gBrowser.addProgressListener(progressListener);
          that.addCleanUpFunction(() => {
            if (winWeak.get()) {
              winWeak.get().removeProgressListener(progressListener);
            }
          });
        };

        winWeak.get().addEventListener("load", onWindowOpen, true);
      },
      onCloseWindow() { },
    };
    Services.wm.addListener(windowListener);
  }

  registerPrivacyHostnameTrigger() {
    this.registerHostnameTrigger(this.VpnRelatedHostnames.PRIVACY_PROVIDER_HOSTNAMES);
  }

  registerCatchallTrigger() {
    const that = this;
    setTimeout(() => {
      that.tryShowNotification();
    }, CATCH_ALL_TRIGGER_TIMER_MINUTES * 60 * 1000);
  }

  registerStreamingHostnameTrigger() {
    this.registerHostnameTrigger(this.VpnRelatedHostnames.STREAMING_HOSTNAMES);
  }

  setTelemetryCallback(callback) {
    this.telemetryCallback = callback; // TOFIX: as of now only sends data back to the last registered event listener
  }

  sendTelemetry(data) {
    if (this.telemetryCallback) {
      this.telemetryCallback(data);
    }
  }

  dontShowChecked(messageName) {
    Preferences.set(DONT_SHOW_PREF, true);

    this.telemetryCallback({
      "message_type": "event",
      "event": "dont-show-checked",
      "message-name": messageName,
    });
  }

  notificationActionCallback(message) {
    log(`notification action: name => ${message.name}, data=> ${JSON.stringify(message.data)}`);

    let eventName;

    if (message.data && message.data.dontShowChecked) {
      this.dontShowChecked(message.name);
    }

    if (message.name === "VpnRecommender::action") {
      eventName = "action";
    }

    if (message.name === "VpnRecommender::dismiss") {
      eventName = "dismiss";
    }

    if (message.name === "VpnRecommender::info") {
      eventName = "info";
    }

    if (message.name === "VpnRecommender::timeout") {
      eventName = "timeout";
    }

    this.telemetryCallback({
      "message_type": "event",
      "event": eventName,
      "dont-show-checked": String(message.data && message.data.dontShowChecked),
    });
  }

  tryShowNotification() {
    if (this.isNotificationShown) return;
    if (Preferences.get(DONT_SHOW_PREF)) return;
    const notificationCount = Preferences.get(NOTIFICATION_COUNT_PREF) || 0;
    if (notificationCount === MAX_NOTIFICATION_COUNT) return;

    const doorhanger = new this.Doorhanger(this.notificationActionCallback.bind(this), `${this.extensionUrl}privileged/vpnRecommender`);
    const success = doorhanger.present({message: DOORHANGER_MESSAGES[this.variation]});

    if (!success) return;

    this.isNotificationShown = true;
    Preferences.set(NOTIFICATION_COUNT_PREF, notificationCount + 1); // increment notification count
  }

  addCleanUpFunction(func) {
    this.cleanUpFunctions.push(func);
  }

  killNotification() {
    const windowEnumerator = Services.wm.getEnumerator("navigator:browser");

    while (windowEnumerator.hasMoreElements()) {
      const win = windowEnumerator.getNext();
      const box = win.document.getElementById("vpn-recommender-doorhanger-panel");
      if (box) {
        box.remove();
      }
    }
  }

  cleanUp() {
    log("cleaning up VPN Recommender");

    for (const f of this.cleanUpFunctions) {
      f();
    }
  }

  getInternals() {
    return {};
  }
};
