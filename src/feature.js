/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(feature)" }]*/

class VpnRecommendationStudy {
  constructor() {}

  configure(studyInfo) {
    const feature = this;
    const { variation, isFirstRun } = studyInfo;

    console.log(`starting study feature: ${studyInfo}`);

    browser.experiments.vpnRecommender.onSendTelemetry.addListener(this.sendTelemetry.bind(this));
    browser.experiments.vpnRecommender.onEndStudy.addListener((reason) => {
      browser.study.endStudy(reason);
    });
    browser.experiments.vpnRecommender.start(variation.name, isFirstRun);
  }

  /* good practice to have the literal 'sending' be wrapped up */
  sendTelemetry(stringStringMap) {
    browser.study.sendTelemetry(stringStringMap);
  }

  async cleanup() {
    browser.experiments.vpnRecommender.cleanUp();
  }
}

// make an instance of the feature class available to background.js
// construct only. will be configured after setup
window.feature = new VpnRecommendationStudy();
