/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

let document;

/* global addMessageListener  sendAsyncMessage content */

const PRIMARY_BUTTON_LABEL = "Tell Me More";
const SECONDARY_BUTTON_LABEL = "Dismiss";

// shims to use jetpack messaging
const self = {
  port: {
    on(header, handle) {
      addMessageListener(header, {
        receiveMessage(message) {
          if (message.name === header)
            handle(message.data);
        },
      });
    },
    emit(header, data) {
      sendAsyncMessage(header, data);
    },
  },
};

self.port.on("VpnRecommender::load", (data) => {
  addEventListener("DOMContentLoaded", () => load(data));
});

function load(data) {
  document = content.document; // eslint-disable-line no-global-assign, no-native-reassign

  console.log("populating doorhanger");

  if (data.isDarkMode) {
    document.body.classList.add("dark");
  }

  const primButtonLabel = PRIMARY_BUTTON_LABEL;
  const secButtonLabel = SECONDARY_BUTTON_LABEL;

  const messageHeaderEle = document.getElementById("message-header");
  const messageEle = document.getElementById("message");

  messageHeaderEle.textContent = data.message.header;
  messageEle.textContent = data.message.text;

  document.getElementById("header").textContent = "Recommendation";
  document.getElementById("prim-button").textContent = primButtonLabel;
  document.getElementById("prim-button").classList.add("external-link");
  document.getElementById("prim-button").dataset.url = "";

  document.getElementById("sec-button").textContent = secButtonLabel;

  // setting the callback
  document.getElementById("sec-button").addEventListener("click", secButtonClick);
  document.getElementById("prim-button").addEventListener("click", primButtonClick);

  document.getElementsByClassName("info-hover-area")[0].addEventListener("click", infoClick);

  document.getElementById("dont-show-checkbox").addEventListener("change", checkBoxChange);
}

function checkBoxChange() {
  const checkboxEle = document.getElementById("dont-show-checkbox");
  self.port.emit("VpnRecommender::dontShowChange", {checked: checkboxEle.checked});
}

function infoClick() {
  self.port.emit("VpnRecommender::info");
}

function secButtonClick() {
  sendAsyncMessage("VpnRecommender::dismiss");
}

function primButtonClick() {
  self.port.emit("VpnRecommender::action");
}
