/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "Doorhanger" }]*/
/* global Preferences */

"use strict";

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/Preferences.jsm");

const DOORHANGER_MAC_SIZE = {width: 280, height: 404};
const DOORHANGER_NON_MAC_SIZE = {width: 282, height: 406};

const PREF_BRANCH = "extensions.vpn-recommendation-study-1_shield_mozilla_org";
const DEBUG_MODE_PREF = PREF_BRANCH + ".debug_mode";

const SELECTED_LWT_THEME_ID = "lightweightThemes.selectedThemeID";
const DEFAULT_THEME_ID = "default-theme@mozilla.org";
const COMPACT_DARK_ID = "firefox-compact-dark@mozilla.org";

const BROWSER_ID = "vpn-recommender-doorhanger";
const PANEL_ID = "vpn-recommender-doorhanger-panel";

const WINDOW_STATE_MAXIMIZED = 1;
const WINDOW_STATE_NORMAL = 3;
const WINDOW_STATE_FULLSCREEN = 4;

const log = function(...args) {
  if (!Preferences.get(DEBUG_MODE_PREF)) return;
  console.log(...args);
};

let panel;

const MESSAGES = [
  "VpnRecommender::dismiss",
  "VpnRecommender::action",
  "VpnRecommender::info",
  "VpnRecommender::dontShowChange",
];

this.EXPORTED_SYMBOLS = ["Doorhanger"];

var Doorhanger  = class { // eslint-disable-line no-var
  constructor(messageListenerCallback, privilegedURL) {
    this.messageListenerCallback = messageListenerCallback;
    this.privilegedURL = privilegedURL;
    this.contentURL = `${privilegedURL}/content`;

    const jsms = {};

    Services.scriptloader.loadSubScript(`${this.privilegedURL}/RecentWindow.jsm`, jsms);
    Services.scriptloader.loadSubScript(`${this.privilegedURL}/EveryWindow.jsm`, jsms);

    this.RecentWindow = jsms.RecentWindow;
    this.EveryWindow = jsms.EveryWindow;

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

  present(data, options = {
    hideOnWindowSelect: false,
    hideOnTabSelect: false,
    hideOnWindowOpen: true,
    hideOnTabOpen: true,
    infoUrl: null,
  }) {
    log("presenting doorhanger");

    this.show(this.getMostRecentBrowserWindow(), data, options);
  }

  show(win, data, options = {}) {
    panel = win.document.getElementById(PANEL_ID);

    const popAnchor = this.determineAnchorElement(win);

    if (panel !== null) {
      this.killAllNotifications();
    }

    panel = win.document.createElement("panel");
    panel.setAttribute("id", PANEL_ID);
    panel.setAttribute("class", "no-padding-panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautofocus", true);
    panel.setAttribute("noautohide", true);
    panel.setAttribute("flip", "slide");
    panel.setAttribute("level", "parent");
    panel.setAttribute("position", "bottomcenter topright");

    const panelSize = Services.appinfo.OS === "Darwin" ? DOORHANGER_MAC_SIZE : DOORHANGER_NON_MAC_SIZE;

    const embeddedBrowser = win.document.createElement("browser");
    embeddedBrowser.setAttribute("id", BROWSER_ID);
    embeddedBrowser.setAttribute("src", `${this.contentURL}/doorhanger/doorhanger.html`);
    embeddedBrowser.setAttribute("type", "content");
    embeddedBrowser.setAttribute("disableglobalhistory", "true");
    embeddedBrowser.setAttribute("flex", "1");
    embeddedBrowser.setAttribute("tooltip", "aHTMLTooltip");

    panel.appendChild(embeddedBrowser);
    win.document.getElementById("mainPopupSet").appendChild(panel);

    const panelContent = win.document.getAnonymousElementByAttribute(panel, "class", "panel-arrowcontent");

    panelContent.style.padding = "0px";
    panelContent.style.height = `${panelSize.height}px`;
    panelContent.style.width = `${panelSize.width}px`;
    if (Services.appinfo.OS === "Darwin") {
      panelContent.style.margin = "1px 0 0 0";
    }

    // seems that messageManager only available when browser is attached
    embeddedBrowser.messageManager.loadFrameScript(this.frame_script_url, false);

    for (const m of MESSAGES) {
      embeddedBrowser.messageManager.addMessageListener(m, this);
    }

    panel.openPopup(popAnchor, "", 0, 0, false, false);

    embeddedBrowser.messageManager.sendAsyncMessage("VpnRecommender::load", { ...data, isDarkMode: this.isDarkMode(win) });

    this.infoUrl = options.infoUrl;

    this.registerAutoDismissalListeners(win, options);

    // workaround for https://github.com/raymak/vpn-recommendation-shield-study/issues/70
    // and https://github.com/raymak/vpn-recommendation-shield-study/issues/73
    const weakWin = Cu.getWeakReference(win);

    const onWindowModeChange = (e) => {
      if (e.target.windowState === WINDOW_STATE_NORMAL) {
        if (panel && panel.state === "closed") {
          panel.openPopup(this.determineAnchorElement(e.target), "", 0, 0, false, false);
          return; // no need for redraw in this case
        }
        if (Services.appinfo.OS === "WINNT") {
          const browser = e.target.document.getElementById(BROWSER_ID);
          this.forceRedraw(browser, e.target);
        }
      }
      if (e.target.windowState === WINDOW_STATE_FULLSCREEN ||
        e.target.windowState === WINDOW_STATE_MAXIMIZED) {
        if (Services.appinfo.OS === "WINNT") {
          const browser = e.target.document.getElementById(BROWSER_ID);
          this.forceRedraw(browser, e.target);
        }
      }
    };

    weakWin.get().addEventListener("sizemodechange", onWindowModeChange);
    this.addCleanUpFunction(() => {
      if (weakWin.get()) {
        weakWin.get().removeEventListener("sizemodechange", onWindowModeChange);
      }
    });
  }

  forceRedraw(element, win) {
    const initial = element.style.display;
    win.setTimeout(() => {
      element.style.display = initial;
    }, 100);
    element.style.display = "none";
  }

  autoDismiss(reason) {
    const message = {
      name: "VpnRecommender::autoDismiss",
      data: { reason },
    };

    this.destruct();
    this.messageListenerCallback(message);
  }

  registerAutoDismissalListeners(panelParentWindow, options) {
    // burger button
    const onBurgerOpen = () => {
      this.autoDismiss("burger-menu");
    };

    const weakBurgerButton = Cu.getWeakReference(panelParentWindow.document.getElementById("PanelUI-menu-button"));
    weakBurgerButton.get().addEventListener("click", onBurgerOpen);

    this.addCleanUpFunction(() => {
      if (weakBurgerButton.get()) {
        weakBurgerButton.get().removeEventListener("click", onBurgerOpen);
      }
    });

    // windows
    const onWindowOpen = () => {
      if (!options.hideOnWindowOpen) return;
      this.autoDismiss("new-window");
    };

    const onWindowSelect = () => {
      if (!options.hideOnWindowSelect) return;
      this.autoDismiss("window-select");
    };

    Services.obs.addObserver(onWindowOpen,
      "browser-delayed-startup-finished");

    Services.obs.addObserver(onWindowSelect,
      "xul-window-visible");

    this.addCleanUpFunction(() => {
      Services.obs.removeObserver(onWindowOpen, "browser-delayed-startup-finished");
      Services.obs.removeObserver(onWindowSelect, "xul-window-visible");
    });

    // tabs
    const onTabOpen = () => {
      if (!options.hideOnTabOpen || this._tabAutoDimissalOff) return;

      this.autoDismiss("new-tab");
    };

    const onTabSelect = () => {
      if (!options.hideOnTabSelect || this._tabAutoDimissalOff) return;

      this.autoDismiss("tab-select");
    };

    const windowInit = (win) => {
      win.gBrowser.tabContainer.addEventListener("TabOpen", onTabOpen);
      win.gBrowser.tabContainer.addEventListener("TabSelect", onTabSelect);
    };

    const windowUninit = (win) => {
      win.gBrowser.tabContainer.removeEventListener("TabOpen", onTabOpen);
      win.gBrowser.tabContainer.removeEventListener("TabSelect", onTabSelect);
    };

    this.EveryWindow.registerCallback("doorhanger-auto-dismissal-listener", windowInit, windowUninit);
    this.addCleanUpFunction(() => {
      this.EveryWindow.unregisterCallback("doorhanger-auto-dismissal-listener");
    });
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

  openInfoPage() {
    // temporarily turn off autodismissal for tabs to give enough time for the tab to open
    this._tabAutoDimissalOff = true;
    const win = this.RecentWindow.getMostRecentBrowserWindow();
    const tab = win.gBrowser.addWebTab(this.infoUrl);
    win.gBrowser.selectedTab = tab;
    this._tabAutoDimissalOff = false;
  }

  killAllNotifications() {
    panel = null;
    const windowEnumerator = Services.wm.getEnumerator("navigator:browser");

    log("killing notifications");

    while (windowEnumerator.hasMoreElements()) {
      const win = windowEnumerator.getNext();
      const box = win.document.getElementById(PANEL_ID);
      if (box) {
        box.remove();
      }
    }
  }

  addCleanUpFunction(func) {
    if (!this.cleanUpFunctions) {
      this.cleanUpFunctions = [];
    }

    this.cleanUpFunctions.unshift(func);
  }

  destruct() {
    if (this._destructed) return;

    this.killAllNotifications();
    this.cleanUp();

    this._destructed = true;
  }

  cleanUp() {
    log("cleaning up doorhanger");

    if (this.cleanUpFunctions) {
      for (const f of this.cleanUpFunctions) {
        try {
          f();
        } catch (e) {

        }
      }
    }
  }

  receiveMessage(message) {
    switch (message.name) {
      case "VpnRecommender::dismiss":
        this.destruct();
        this.messageListenerCallback(message);
        break;

      case "VpnRecommender::action":
        this._tabAutoDimissalOff = true;
        this.destruct();
        this.messageListenerCallback(message);
        break;

      case "VpnRecommender::info":
        if (this.infoUrl) {
          // if the url of the info page is given as an option, open it here, otherwise let the host
          // module handle it
          this.openInfoPage();
        }
        this.messageListenerCallback(message);
        break;

      case "VpnRecommender::dontShowChange":
        this.messageListenerCallback(message);
        break;

      default:
        this.messageListenerCallback(message);
    }
  }
};
