async function removeOldSessions() {
  let { currentSiteSessions } = await chrome.storage.local.get("currentSiteSessions");
  let allTabs = await chrome.tabs.query({ url: Object.keys(currentSiteSessions).map(host => `*://${host}/*`) });
  let allHosts = new Set(allTabs.filter(el => el.url).map(tab => new URL(tab.url).host));
  let hostsToRemove = Object.keys(currentSiteSessions).filter(host => !allHosts.has(host));
  if (hostsToRemove.length > 0) {
    console.debug("[GOTS] Removing old sessions: ", hostsToRemove);
    let { previousSessions } = await chrome.storage.local.get("previousSessions");
    hostsToRemove.forEach(host => {
      // We want to add the session to the previous sessions list, and then remove it from the current sessions list
      if (!previousSessions[host]) previousSessions[host] = [];
      currentSiteSessions[host].endTime = Date.now();
      previousSessions[host].push(currentSiteSessions[host]);
      delete currentSiteSessions[host];
    });
    await chrome.storage.local.set({ currentSiteSessions, previousSessions });
    await Promise.all(hostsToRemove.map(host => chrome.alarms.clear(host)));
  }
}

async function grayscaleTab(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, css: "html {filter: saturate(0) brightness(1) contrast(10) !important;}" })
}

function calculateAverages(previousSessions) {
  if (!previousSessions || previousSessions.length < 1)  return { spent: 0, predicted: 0 };
  // This sums up the total time spent on the site, and the total time predicted, and then divides by the number of sessions to get the average
  let spent = previousSessions.reduce((acc, el) => acc + el.endTime - el.startTime, 0) / previousSessions.length;
  let predicted = previousSessions.reduce((acc, el) => acc + el.prediction - el.startTime, 0) / previousSessions.length;
  return { spent, predicted };
}

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    chrome.storage.local.set({ previousSessions: {}, currentSiteSessions: {} });
    chrome.tabs.create({ url: "/onboarding.html" });
  }
  void removeOldSessions();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await removeOldSessions();
  if (tab.url && changeInfo.status === "complete") { // If we have host permissions and the tab is loaded
    let { currentSiteSessions, previousSessions } = await chrome.storage.local.get(["currentSiteSessions", "previousSessions"]);
    let parsedUrl = new URL(tab.url);
    if (!(parsedUrl.host in currentSiteSessions)) {
      console.debug("[GOTS] Initializing new session flow: ", parsedUrl.host);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (frameUrlString, host, { spent, predicted }) => {
          // We want to create an iframe that will prompt the user to predict how much time they will spend on the site
          let popup = document.createElement("iframe");
          let frameUrl = new URL(frameUrlString);
          frameUrl.searchParams.set("host", host);
          frameUrl.searchParams.set("predicted", Math.round(predicted / 1000 / 60));
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
        args: [chrome.runtime.getURL("/prediction-prompt.html"), parsedUrl.host, calculateAverages(previousSessions[parsedUrl.host])]
      });
    } else if (currentSiteSessions[parsedUrl.host].prediction < Date.now())
      await grayscaleTab(tabId); // If the predicted time has already elapsed, we want to grayscale the tab
  }
});

chrome.tabs.onRemoved.addListener(async () => await removeOldSessions());

// This is the listener for the alarm that is set when a session is started after the user predicts how much time they will spend on the site
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return; // We only want to listen to messages from our extension (not other extensions)
  if (message.type === "startSession" && parseInt(message.prediction) >= 1 && message.host) {
    let { currentSiteSessions } = await chrome.storage.local.get(["currentSiteSessions"]);
    if (message.host in currentSiteSessions) return; // If the user has already started a session for this site, we don't want to start another one
    console.debug("[GOTS] Starting session for ", message.host, " with prediction ", message.prediction);
    let predictionEndMs = Date.now() + parseInt(message.prediction) * 1000 * 60;
    chrome.alarms.create(message.host, { when: predictionEndMs });
    currentSiteSessions[message.host] = {
      startTime: Date.now(),
      prediction: predictionEndMs
    };
    chrome.storage.local.set({ currentSiteSessions });
  } else if (message.type === "calculateAverages" && message.previousSessions)
    sendResponse(message.previousSessions.map(a => calculateAverages(a)));
});

// When the user's predicted time alarm goes off, we want to start grayscaling the tabs
chrome.alarms.onAlarm.addListener(async alarm => {
  let allTabs = await chrome.tabs.query({ url: `*://${alarm.name}/*` });
  allTabs.forEach(tab => grayscaleTab(tab.id));
});