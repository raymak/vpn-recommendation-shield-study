## VPN Recommender Shield Study 

This extension is a [Firefox SHIELD](https://support.mozilla.org/en-US/kb/shield) Study that recommends a VPN solution to users who may benefit from it.

### Build the extension

Note: this step is optional, you can download a [recent version of the zip here (private URL)](https://drive.google.com/drive/folders/1sRQDC2brfsXGTcJO6ElkbeqakdKA1cln?usp=sharing).

```
npm install
npm run build
```
The extension zip file can then be found in the /dist folder.

### Run the extension

This extension contains privileged code as WebExtension APIs and therefore can only be run in Firefox Nightly or Dev edition.

#### To run the extension in the browser:
1. Unzip the extension
2. Open Firefox Nightly
3. Set your desired branch if you want to (see next section), otherwise you will randomly get into one of the branches
4. Go to __about:debugging__
5. Click on "Load Temporary Add-on..."
6. Select a file from the unzipped extension folder

##### To set the branch (should be done before loading the study extension):
1. Go to about:config
2. Click on "I accept the risk!"
3. Right click and select "New -> String" form the context menu
4. Create the "extensions.vpn-recommendation-study-1_shield_mozilla_org.test.variationName" pref
5. Set the value to the desired branch name (see below)

##### Branch names
- captive-portal: in Browser Console type `browser.experiments.vpnRecommender.fakeCaptivePortal()`
- privacy-hostname: triggered when you visit websites, examples include disconnect.me and strongvpn.com
- control
- catch-all
- streaming-hostname: triggered when you visit websites, examples include hulu.com and netflix.com





