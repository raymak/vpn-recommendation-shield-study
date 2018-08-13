/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(feature)" }]*/

/**  Example Feature module for a Shield Study.
 *
 *  UI:
 *  - during INSTALL only, show a notification bar with 2 buttons:
 *    - "Thanks".  Accepts the study (optional)
 *    - "I don't want this".  Uninstalls the study.
 *
 *  Firefox code:
 *  - Implements the 'introduction' to the 'button choice' study, via notification bar.
 *
 *  Demonstrates `studyUtils` API:
 *
 *  - `telemetry` to instrument "shown", "accept", and "leave-study" events.
 *  - `endStudy` to send a custom study ending.
 *
 **/
class VpnRecommendationStudy {
  constructor() {}
  /** A Demonstration feature.
   *
   *  - variation: study info about particular client study variation
   *  - reason: string of background.js install/startup/shutdown reason
   *
   */
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

  /**
   * Called at end of study, and if the user disables the study or it gets uninstalled by other means.
   */
  async cleanup() {}

  /**
   * Example of a utility function
   *
   * @param variation
   * @returns {string}
   */
  static iconPath(variation) {
    return `icons/${variation.name}.svg`;
  }
}

// make an instance of the feature class available to background.js
// construct only. will be configured after setup
window.feature = new VpnRecommendationStudy();
