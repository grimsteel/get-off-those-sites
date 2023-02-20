# Get Off Those Sites

A simple extension which aims to keep you off mind numbing sites like Facebook and Twitter (henceforth referred to as "the sites")

## Installation

1. Clone the repo
2. Open Chrome and go to `chrome://extensions`
3. Enable developer mode
4. Click "Load unpacked" and select the src folder

## User Flow:

**Install**: The user is shown an onboarding page which includes buttons to to add typical sites to the extension

**Settings**: The user can manage existing sites added and add new ones.

**Popup**: If the user is on a site added to the extension, it shows stats about it including average time spent and average time predicted

**Tab**:
When the user opens a new page, the extension checks if there is an existing "session" with the URL domain. If there is _not_, the extension creates a session and prompts the user to predict how long they will spend on the site.

If a tab is closed, the extension checks to see if _all_ tabs on that domain are closed. If so, the extension ends the session and calculates the stats

When the user's predicted time elapses, the extension grayscales all tabs with the domain