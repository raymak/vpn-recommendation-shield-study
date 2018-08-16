"use strict";

/* global ExtensionAPI, ExtensionCommon */



const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
XPCOMUtils.defineLazyServiceGetter(this, "resProto",
  "@mozilla.org/network/protocol;1?name=resource",
  "nsISubstitutingProtocolHandler");

this.vpnRecommender = class extends ExtensionAPI {

  getAPI(context) {
    console.log("context", context);
    ChromeUtils.import(context.extension.getURL("privileged/vpnRecommender/Doorhanger.jsm"), this);
    this.extensionUrl = context.extension.getURL();

    const EventManager = ExtensionCommon.EventManager;

    const that = this;

    return {
      experiments: {
        vpnRecommender: {
          echo(str) {
            console.log(`echoing: ${str}`);
          },

          start(variation, isFirstRun) {
            that.start(variation, isFirstRun);
          },

          getInternals() {
            return that.getInternals();
          },

          onActiveTick: new EventManager(context, "vpnRecommender.onActiveTick", fire => {
            registerActiveTickCallback(() => fire.async());
            return () => {};
          }).api(),

          onSendTelemetry: new EventManager(context, "vpnRecommender.onSendTelemetry", fire => {
            that.setTelemetryCallback((data) => fire.async(data));
            return () => {};
          }).api(),
        },
      },
    };
  }

  start(variation, isFirstRun) {
    this.registerListeners(variation);
    // this.showNotification();

    if (isFirstRun) {
      this.sendTelemetry({
        "message_type": "event",
        "event": "study-start",
      });
    }

    // Services.obs.notifyObservers(null, "captive-portal-login", null);
  }

  registerListeners(variation) {
    if (variation === "captive-portal") {
      console.log("registering captive-portal detection");
      this.registerCaptivePortalTrigger();
    }

    if (variation === "hostname-visit") {
      this.registerHostnameTrigger();
    }

    if (variation === "control") { return; }

    if (variation === "non-targeted") {
      this.registerRandomTrigger();
    }
  }

  registerCaptivePortalTrigger() {
    const that = this;

    const cpObserver = {
      observe(subject, topic, data) {
        if (topic !== "captive-portal-login") return;
        console.log("captive-portal-login");
        that.showNotification();
      },
    };

    Services.obs.addObserver(cpObserver, "captive-portal-login");
  }

  setTelemetryCallback(callback) {
    this.telemetryCallback = callback; // TOFIX: as of now only sends data back to the last registered event listener
  }

  sendTelemetry(data) {
    if (this.telemetryCallback) {
      this.telemetryCallback(data);
    }
  }

  showNotification() {
    // if (this.isNotificationShown) return;

    const doorhanger = new this.Doorhanger( console.log, `${this.extensionUrl}privileged/vpnRecommender`);
    doorhanger.present();

    this.isNotificationShown = true;
  }

  getInternals() {
    return {};
  }
};
