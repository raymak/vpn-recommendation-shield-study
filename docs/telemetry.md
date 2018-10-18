# Telemetry pings sent by the extension

All pings sent by the extension will follow the [common ping format](https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/telemetry/data/common-ping.html). As such, we only describe the structure of the raw payload of each ping type. 

## Study-specific pings

These pings are specifc to this study.

### Payload format

```javascript
{
	"version": 3,
	"study_name": "vpn-recommendation-study-1@shield.mozilla.org",
	"branch": "", // branch name, one of 'catch-all', 'captive-portal', 'streaming-hostname', 'privacy-hostname', 'control'
	"addon_version": "", // addon version
	"shield_version": "", // shield utils version
	"type": "shield-study-addon", // distinguishes between shield-study-addon (study-specifc) and shield-study pings
	"data": {
		"attributes": {
			// this is a string-to-string mapping that carries the main information in the ping
		}
	},
	"testing": // true or false depending on whether the addon is in production or not
}
```

### Message types

This section describes the different types of messages that are sent in the ```attributes``` field of the study-specific ping payloads. Keep in mind that these are all string-to-string mappings, that is, both keys and values are strings. [This schema](/schema.json) matches these string-to-string mappings.

#### message_type: event

Message sent for every event. The events are described as below:

- ```trigger```: the user hit one of the study triggers. Per [this issue](https://github.com/raymak/vpn-recommendation-shield-study/issues/75) it does not include ```privacy-hostname``` and ```streaming-hostname```.
- ```notification-delivered```: an actual notification was delivered. 
- ```study-start```: the study started.
- ```shadow-notification```: a shadow notification was delivered. This is not an actual notification that the user sees, since the trigger for this notification could be different from the trigger of the study branch.
- ```action```: the user clicked on the "Tell me more" button in the panel.
- ```info```: the user clicked on the ? sign in the panel that takes them to the support page.
- ```dismiss```: the user clicked on the "dismiss" button in the panel.
- ```auto-dismiss```: the panel was automatically dismissed due to one of the conditions in this [issue](https://github.com/raymak/vpn-recommendation-shield-study/issues/43).
- ```dont-show-change```: the user changed the state of the "Don't tell me about this again." checkbox.

The following examples demonstrate the fields that are available in each of the mentioned event types.

```javascript
{
	"message_type": "event",
	"event": "trigger",
	"trigger": "captive-portal", // one of 'catch-all', 'captive-portal', other triggers are ignored per https://github.com/raymak/vpn-recommendation-shield-study/issues/75
	"is-shadow": "true" // shows whether this was a shadow trigger (not matching the study branch)
}
````

```javascript
{
	"message_type": "event",
	"event": "notification-delivered",
	"number": "2" // shows if this is the 1st, 2nd, or 3rd notification
}
```

``` javascript
{
	"message_type": "event",
	"event": "study-start"
}
````

```javascript
{
	"message_type": "event",
	"event": "shadow-notification",
	"number": "1", // this number corresponds only with the hypothetical notifications for this particular trigger
	"trigger": "streaming-hostname",
	"is-shadow": "false"
}
```

```javascript
{
	"message_type": "event",
	"event": "action"
}
```

```javascript
{
	"message_type": "event",
	"event": "info"
}
```

```javascript
{
	"message_type": "event",
	"event": "dismiss"
}
```

```javascript
{
	"message_type": "event",
	"event": "auto-dismiss"
}
```

```javascript
{
	"message_type": "event",
	"event": "dont-show-change"
}
```

#### message_type: auto_dismissal_event

Gives more information about a panel auto dismissal event. See [this issue](https://github.com/raymak/vpn-recommendation-shield-study/issues/43). 

Example

```javascript
{
	"message_type": "auto_dismissal_event",
	"reason": "new-tab" // one of new-window, new-tab, tab-select, window-select, burger-menu
}
```

### message_type: dont_show_change_event

Gives more information about the "Don't tell me about this again." checkbox state change.

Example

```javascript
{
	"message_type": "dont_show_change_event",
	"checked": "true" // the new state of the checkbox
}
```

### message_type: notification_result

Gives more information about the result of a notification that has concluded (the panel has been closed).

Example

```javascript
{
	"message_type": "notification_result",
	"number": "1",
	"dont-show-checked": "false",
	"result": "dismiss" // one of action, dismiss, auto-dimiss, unknown
}
```

### message_type: captive_portal_connection_check

Gives more information about when the extension is checking that Firefox has successfully connected to the internet after a captive portal is detected.

Example

```javascript
{
	"message_type": "captive_portal_connection_check",
	"success": "true", // whether or not the user was connected to the internet within the given timeframe (2 minutes)
	"time": "40000" // the approximate time from when captive portal was detected until the user connected to the internet in milliseconds
}
```

## Shield pings

These pings are common among all Shield studies using Shield utils and only cover the high-level study state information.

### Payload format

```javascript
{
	"version": 3,
	"study_name": "vpn-recommendation-study-1@shield.mozilla.org",
	"branch": "", // branch name, one of 'catch-all', 'captive-portal', 'streaming-hostname', 'privacy-hostname', 'control'
	"addon_version": "", // addon version
	"shield_version": "", // shield utils version
	"type": "shield-study", // distinguishes between shield-study-addon (study-specifc) and shield-study pings
	"data": {
		"study_state": "" // one of enter, installed, user-disable, expires, exit
	},
	"testing": // true or false depending on whether the addon is in production or not
}
```

#### Study states

- ```installed```: the extension was installed and run on the user's Firefox.
- ```enter```: the user has entered into the study.
- ```ineligible```: the user did not enter into the study and the study ended.
- ```expired```: the study ended due to expiry date.
- ```user-disable```: the study ended because the user disabled the study.
- ```exit```: the study ended.
