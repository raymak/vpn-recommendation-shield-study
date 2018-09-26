/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "RecentWindow|EXPORTED_SYMBOLS" }]*/

"use strict";

const EXPORTED_SYMBOLS = ["RecentWindow"];

ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

var RecentWindow = { // eslint-disable-line no-var
  /*
   * Get the most recent browser window.
   *
   * @param options an object accepting the arguments for the search.
   *        * private: true to restrict the search to private windows
   *            only, false to restrict the search to non-private only.
   *            Omit the property to search in both groups.
   *        * allowPopups: true if popup windows are permissable.
   */
  getMostRecentBrowserWindow: function RW_getMostRecentBrowserWindow(options) {
    const checkPrivacy = typeof options === "object" &&
                       "private" in options;

    const allowPopups = typeof options === "object" && !!options.allowPopups;

    function isSuitableBrowserWindow(win) {
      return (!win.closed &&
              (allowPopups || win.toolbar.visible) &&
              (!checkPrivacy ||
               PrivateBrowsingUtils.permanentPrivateBrowsing ||
               PrivateBrowsingUtils.isWindowPrivate(win) === options.private));
    }

    const broken_wm_z_order =
      AppConstants.platform !== "macosx" && AppConstants.platform !== "win";

    if (broken_wm_z_order) {
      let win = Services.wm.getMostRecentWindow("navigator:browser");

      // if we're lucky, this isn't a popup, and we can just return this
      if (win && !isSuitableBrowserWindow(win)) {
        win = null;
        const windowList = Services.wm.getEnumerator("navigator:browser");
        // this is oldest to newest, so this gets a bit ugly
        while (windowList.hasMoreElements()) {
          const nextWin = windowList.getNext();
          if (isSuitableBrowserWindow(nextWin))
            win = nextWin;
        }
      }
      return win;
    }
    const windowList = Services.wm.getZOrderDOMWindowEnumerator("navigator:browser", true);
    while (windowList.hasMoreElements()) {
      const win = windowList.getNext();
      if (isSuitableBrowserWindow(win))
        return win;
    }
    return null;
  },
};

