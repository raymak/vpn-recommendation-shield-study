/* ! This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

let document;
let recipe;
let timeoutTimer;

/* global addMessageListener  sendAsyncMessage content */

/* exported capitalize, changeBodySize */
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
  content.addEventListener("load", () => load());
});

function load() {

  document = content.document; // eslint-disable-line no-global-assign, no-native-reassign

  const primButtonLabel = "Tell Me More";
  const secButtonLabel = "Not Now";

  const messageEle = document.getElementById("message");

  messageEle.textContent = "Make Firefox Even More Secure with CyberVPN";

  document.getElementById("header").textContent = "Recommendation";
  document.getElementById("prim-button").textContent = primButtonLabel;
  document.getElementById("prim-button").classList.add("external-link");
  document.getElementById("prim-button").dataset.url = "";

  document.getElementById("sec-button").textContent = secButtonLabel;

  document.getElementById("fake-checkbox").addEventListener("click", () => {
    toggleCheckbox();
  });
  
  // setting the callback
  document.getElementById("sec-button").addEventListener("click", secButtonClick);
  document.getElementById("prim-button").addEventListener("click", primButtonClick);


  registerExternalLinks();

  // updatePanelSize();

  timeoutTimer = content.setTimeout(timeout, 3 * 60 * 1000);
}

function registerExternalLinks() {
  for (const ele of document.getElementsByClassName("external-link")) {
    ele.addEventListener("click", (e) => {
      sendAsyncMessage("VpnRecommender::openUrl", ele.dataset.url);
      e.preventDefault();
    });
  }
}

function infoClick(e) {
  self.port.emit("infoPage");
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function secButtonClick() {
  const realCheckboxEle = document.getElementById("real-checkbox");
  sendAsyncMessage("VpnRecommender::dismiss", realCheckboxEle.checked);
  clearTimeout();
}

function primButtonClick() {
  // self.port.emit("VpnRecommender::action");
  self.port.emit("VpnRecommender::dismiss")
  clearTimeout();
}

function closeButtonClick() {
  const realCheckboxEle = document.getElementById("real-checkbox");
  self.port.emit("VpnRecommender::close", realCheckboxEle.checked);
  clearTimeout();
}

function changeBodySize(panelSize) {
  document.body.style.width = (panelSize.width - 2).toString() + "px";
  document.body.style.height = (panelSize.height - 3).toString() + "px";
}

function updatePanelSize(width, height) {
  self.port.emit("VpnRecommender::resize", {height: height || Number(content.getComputedStyle(document.body).height.slice(0, -2)),
    width: width || Number(content.getComputedStyle(document.body).width.slice(0, -2))});
}

function toggleCheckbox() {
  const realCheckboxEle = document.getElementById("real-checkbox");
  const fakeCheckboxEle = document.getElementById("fake-checkbox");
  if (realCheckboxEle.checked === false) {
    realCheckboxEle.checked = true;
    fakeCheckboxEle.style.backgroundColor = "#0187fe";
  } else {
    realCheckboxEle.checked = false;
    fakeCheckboxEle.style.backgroundColor = "white";
  }
}

function timeout() {
  const realCheckboxEle = document.getElementById("real-checkbox");
  sendAsyncMessage("VpnRecommender::timeout", realCheckboxEle.checked);
}

function clearTimeout() {
  content.clearTimeout(timeoutTimer);
}

self.port.emit("panel-ready");
