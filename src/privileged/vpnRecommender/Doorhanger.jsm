/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

ChromeUtils.import("resource://gre/modules/Console.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/Timer.jsm");

ChromeUtils.defineModuleGetter(this, "Preferences", "resource://gre/modules/Preferences.jsm");

const DEBUG_MODE_PREF = "extensions.vpn_recommender_debug_mode";

const log = function(...args) {
  if (!Preferences.get(DEBUG_MODE_PREF)) return;
  console.log(...args);
};

let panel;

const MESSAGES = [
  "VpnRecommender::log",
  "VpnRecommender::openUrl",
  "VpnRecommender::dismiss",
  "VpnRecommender::close",
  "VpnRecommender::action",
  "VpnRecommender::timeout",
  "VpnRecommender::resize",
];

this.EXPORTED_SYMBOLS = ["Doorhanger"];

/* eslint-disable-next-line no-unused-vars */
class Doorhanger {
  constructor(messageListenerCallback, privilegedURL) {
    this.messageListenerCallback = messageListenerCallback;
    this.privilegedURL = privilegedURL;
    this.contentURL = `${privilegedURL}/content`;

    ChromeUtils.import(`${this.privilegedURL}/RecentWindow.jsm`, this);
    console.log("recent window address", `${this.privilegedURL}/RecentWindow.jsm`);

    // Due to bug 1051238 frame scripts are cached forever, so we can't update them
    // as a restartless add-on. The Math.random() is the work around for this.
    this.frame_script_url = (`${this.contentURL}/doorhanger/doorhanger.js?${Math.random()}`);
  }

  getMostRecentBrowserWindow() {
    return this.RecentWindow.getMostRecentBrowserWindow({
      private: false,
      allowPopups: false,
    });
  }

  present() {
    log("presenting doorhanger");
    this.show(this.getMostRecentBrowserWindow());
  }

  show(win) {
    panel = win.document.getElementById("vpn-recommender-doorhanger-panel");

    const popAnchor = this.determineAnchorElement(win);

    if (panel !== null) {
      this.killNotification();
    }

    panel = win.document.createElement("panel");
    panel.setAttribute("id", "vpn-recommender-doorhanger-panel");
    panel.setAttribute("class", "no-padding-panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautofocus", true);
    panel.setAttribute("noautohide", true);
    panel.setAttribute("flip", "slide");
    panel.setAttribute("level", "parent");

    if (Services.appinfo.OS === "Darwin") {
      panel.style.height = "355px";
      panel.style.width = "282px";
    } else {
      panel.style.height = "355px";
      panel.style.width = "282px";
    }

    const embeddedBrowser = win.document.createElement("browser");
    embeddedBrowser.setAttribute("id", "vpn-recommender-doorhanger");
    embeddedBrowser.setAttribute("src", `${this.contentURL}/doorhanger/doorhanger.html`);
    embeddedBrowser.setAttribute("type", "content");
    embeddedBrowser.setAttribute("disableglobalhistory", "true");
    embeddedBrowser.setAttribute("flex", "1");

    panel.appendChild(embeddedBrowser);
    win.document.getElementById("mainPopupSet").appendChild(panel);

    win.document.getAnonymousElementByAttribute(panel, "class", "panel-arrowcontent").setAttribute("style", "padding: 0px;");

    // seems that messageManager only available when browser is attached
    embeddedBrowser.messageManager.loadFrameScript(this.frame_script_url, false);

    for (const m of MESSAGES) {
      embeddedBrowser.messageManager.addMessageListener(m, this);
    }

    panel.openPopup(popAnchor, "", 0, 0, false, false);

    embeddedBrowser.messageManager.sendAsyncMessage("VpnRecommender::load");
  }

  // temporary workaround
  determineAnchorElement(win) {
    const burgerButton = win.document.getElementById("PanelUI-menu-button");
    const popAnchor = burgerButton;

    return popAnchor;
  }

  killNotification() {
    const windowEnumerator = Services.wm.getEnumerator("navigator:browser");

    log("killing notification");

    while (windowEnumerator.hasMoreElements()) {
      const win = windowEnumerator.getNext();
      const box = win.document.getElementById("vpn-recommender-doorhanger-panel");
      if (box) {
        box.remove();
      }
    }
  }


  // makes sure all the async messages are received by Recommender.jsm first
  killNotificationWithDelay(delay) {
    setTimeout(this.killNotification, delay);
  }

  receiveMessage(message) {
    switch (message.name) {
      case "VpnRecommender::log":
        log(message.data);
        break;

      case "VpnRecommender::dismiss":
        this.killNotificationWithDelay(0);
        this.messageListenerCallback(message);
        break;

      case "VpnRecommender::action":
        this.killNotificationWithDelay(0);
        this.messageListenerCallback(message);
        break;

      case "VpnRecommender::close":
        this.killNotificationWithDelay(0);
        this.messageListenerCallback(message);
        break;

      case "VpnRecommender::timeout":
        this.killNotification();
        this.messageListenerCallback(message);
        break;

      case "VpnRecommender::resize":
        log("updating panel size to :", message.data);
        panel.sizeTo(message.data.width + 3, message.data.height + 21);
        break;

      default:
        this.messageListenerCallback(message);
    }
  }

  shutdown() {
    this.killNotification();
  }
}
