/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "Doorhanger" }]*/
/* global Preferences */

"use strict";

ChromeUtils.import("resource://gre/modules/Services.jsm");

ChromeUtils.defineModuleGetter(this, "Preferences", "resource://gre/modules/Preferences.jsm");
ChromeUtils.defineModuleGetter(this, "setTimeout", "resource://gre/modules/Timer.jsm");

const DOORHANGER_MAC_SIZE = {width: 280, height: 403};
const DOORHANGER_NON_MAC_SIZE = {width: 282, height: 406};

const PREF_BRANCH = "extensions.vpn-recommendation-study-1_shield_mozilla_org";
const DEBUG_MODE_PREF = PREF_BRANCH + "debug_mode";

const SELECTED_LWT_THEME_ID = "lightweightThemes.selectedThemeID";
const DEFAULT_THEME_ID = "default-theme@mozilla.org";
const COMPACT_DARK_ID = "firefox-compact-dark@mozilla.org";

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
  "VpnRecommender::info",
];

this.EXPORTED_SYMBOLS = ["Doorhanger"];

var Doorhanger  = class { // eslint-disable-line no-var
  constructor(messageListenerCallback, privilegedURL) {
    this.messageListenerCallback = messageListenerCallback;
    this.privilegedURL = privilegedURL;
    this.contentURL = `${privilegedURL}/content`;

    this.jsms = {};

    Services.scriptloader.loadSubScript(`${this.privilegedURL}/RecentWindow.jsm`, this.jsms);
    log("recent window address", `${this.privilegedURL}/RecentWindow.jsm`);

    this.RecentWindow = this.jsms.RecentWindow;

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

  present(data) {
    if (!this.getMostRecentBrowserWindow()) {
      return false; // if all windows are private
    }

    log("presenting doorhanger");
    this.show(this.getMostRecentBrowserWindow(), data);

    return true;
  }

  show(win, data) {
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
    panel.setAttribute("position", "bottomcenter topright");

    const panelSize = Services.appinfo.OS === "Darwin" ? DOORHANGER_MAC_SIZE : DOORHANGER_NON_MAC_SIZE;

    const embeddedBrowser = win.document.createElement("browser");
    embeddedBrowser.setAttribute("id", "vpn-recommender-doorhanger");
    embeddedBrowser.setAttribute("src", `${this.contentURL}/doorhanger/doorhanger.html`);
    embeddedBrowser.setAttribute("type", "content");
    embeddedBrowser.setAttribute("disableglobalhistory", "true");
    embeddedBrowser.setAttribute("flex", "1");

    panel.appendChild(embeddedBrowser);
    win.document.getElementById("mainPopupSet").appendChild(panel);

    const panelContent = win.document.getAnonymousElementByAttribute(panel, "class", "panel-arrowcontent");

    panelContent.style.padding = "0px";
    panelContent.style.height = `${panelSize.height}px`;
    panelContent.style.width = `${panelSize.width}px`;
    panelContent.style.margin = "1px 0px 0px 0px";

    // seems that messageManager only available when browser is attached
    embeddedBrowser.messageManager.loadFrameScript(this.frame_script_url, false);

    for (const m of MESSAGES) {
      embeddedBrowser.messageManager.addMessageListener(m, this);
    }

    panel.openPopup(popAnchor, "", 0, 0, false, false);

    embeddedBrowser.messageManager.sendAsyncMessage("VpnRecommender::load", { ...data, isDarkMode: this.isDarkMode(win) });
  }

  isDarkMode(win) {
    const isSystemDark = win.matchMedia("(-moz-system-dark-theme)").matches;
    const lwtThemeId = Preferences.get(SELECTED_LWT_THEME_ID);

    if (!lwtThemeId) return false;

    if (lwtThemeId === COMPACT_DARK_ID) return true;
    if (lwtThemeId === DEFAULT_THEME_ID && isSystemDark) return true;

    return false;
  }

  determineAnchorElement(win) {
    const burgerButton = win.document.getElementById("PanelUI-menu-button");
    const popAnchor = win.document.getAnonymousElementByAttribute(burgerButton, "class", "toolbarbutton-icon");

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


  // makes sure all the async messages are received by the receiving end first
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

      case "VpnRecommender::info":
        this.messageListenerCallback(message);
        break;

      default:
        this.messageListenerCallback(message);
    }
  }
};
