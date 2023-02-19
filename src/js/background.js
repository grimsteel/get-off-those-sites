async function removeOldSessions() {
  let { currentSiteSessions } = await chrome.storage.local.get("currentSiteSessions");
  let allTabs = await chrome.tabs.query({ url: Object.keys(currentSiteSessions).map(host => `*://${host}/*`) });
  let allHosts = new Set(allTabs.filter(el => el.url).map(tab => new URL(tab.url).host));
  let hostsToRemove = Object.keys(currentSiteSessions).filter(host => !allHosts.has(host));
  if (hostsToRemove.length > 0) {
    console.debug("[GOTS] Removing old sessions: ", hostsToRemove);
    let { averageTimeSpent } = await chrome.storage.local.get("averageTimeSpent");
    hostsToRemove.forEach(host => {
      if (!averageTimeSpent[host]) averageTimeSpent[host] = { spent: 0, predicted: 0, totalSessions: 0 };
      calculateAverages(currentSiteSessions[host], averageTimeSpent[host]);
      delete currentSiteSessions[host];
    });
    await chrome.storage.local.set({ currentSiteSessions, averageTimeSpent });
    await Promise.all(hostsToRemove.map(host => chrome.alarms.clear(host)));
  }
}

function calculateAverages(sessionObject, averageObject) {
  let totalTimeSpent = Date.now() - sessionObject.startTime;
  let allTimeSpent = averageObject.spent * averageObject.totalSessions;
  let allTimePredicted = averageObject.predicted * averageObject.totalSessions;
  averageObject.totalSessions++;
  averageObject.spent = (allTimeSpent + totalTimeSpent) / averageObject.totalSessions;
  averageObject.predicted = (allTimePredicted + parseInt(sessionObject.prediction)) / averageObject.totalSessions;
  return averageObject;
}

async function grayscaleTab(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, css: "html {filter: saturate(0) brightness(0.7) contrast(10);mix-blend-mode: multiply;}" })
}

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    chrome.storage.local.set({ averageTimeSpent: {}, currentSiteSessions: {} });
    chrome.tabs.create({ url: "/onboarding.html" });
  }
  void removeOldSessions();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await removeOldSessions();
  if (tab.url && changeInfo.status === "complete") { // If we have host permissions and the tab is loaded
    let { currentSiteSessions, averageTimeSpent } = await chrome.storage.local.get(["currentSiteSessions", "averageTimeSpent"]);
    let parsedUrl = new URL(tab.url);
    if (!(parsedUrl.host in currentSiteSessions)) {
      console.debug("[GOTS] Initializing new session flow: ", parsedUrl.host);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (frameUrlString, host, { spent, predicted }) => {
          let popup = document.createElement("iframe");
          let frameUrl = new URL(frameUrlString);
          frameUrl.searchParams.set("host", host);
          frameUrl.searchParams.set("predicted", predicted);
          frameUrl.searchParams.set("actual", Math.round(spent / 1000 / 60));
          popup.src = frameUrl.toString();
          popup.style.position = "fixed";
          popup.style.top = "1rem";
          popup.style.right = "1rem";
          popup.style.zIndex = "10000";
          popup.style.borderRadius = "5px";
          popup.style.border = "none";
          popup.width = "400";
          popup.height = "300";
          addEventListener("message", e => {
            if (e.data === "GOTS_CLOSE_IFRAME") popup.remove();
          });
          document.body.appendChild(popup);
          console.log("added");
        },
        args: [chrome.runtime.getURL("/prediction-prompt.html"), parsedUrl.host, averageTimeSpent[parsedUrl.host] || { spent: 0, predicted: 0 }]
      });
    } else if (currentSiteSessions[parsedUrl.host].predictionMs < Date.now())
      await grayscaleTab(tabId); // If the predicted time has already elapsed, we want to grayscale the tab
  }
});

chrome.tabs.onRemoved.addListener(async () => await removeOldSessions());

// This is the listener for the alarm that is set when a session is started after the user predicts how much time they will spend on the site
chrome.runtime.onMessage.addListener(async message => {
  if (message.type === "startSession" && parseInt(message.prediction) >= 1 && message.host) {
    let { currentSiteSessions } = await chrome.storage.local.get(["currentSiteSessions"]);
    if (message.host in currentSiteSessions) return; // If the user has already started a session for this site, we don't want to start another one
    console.debug("[GOTS] Starting session for ", message.host, " with prediction ", message.prediction);
    let predictionEndMs = Date.now() + parseInt(message.prediction) * 1000 * 60;
    chrome.alarms.create(message.host, { when: predictionEndMs });
    currentSiteSessions[message.host] = {
      startTime: Date.now(),
      prediction: message.prediction,
      predictionMs: predictionEndMs
    };
    chrome.storage.local.set({ currentSiteSessions });
  }
});

// When the user's predicted time alarm goes off, we want to start grayscaling the tabs
chrome.alarms.onAlarm.addListener(async alarm => {
  let allTabs = await chrome.tabs.query({ url: `*://${alarm.name}/*` });
  allTabs.forEach(tab => grayscaleTab(tab.id));
});