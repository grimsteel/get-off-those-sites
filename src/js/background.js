importScripts("psl.min.js");

async function removeOldSessions() {
  let { currentSiteSessions } = await chrome.storage.local.get("currentSiteSessions");
  let allTabs = await chrome.tabs.query({ url: Object.keys(currentSiteSessions).map(domain => `*://*.${domain}/*`) });
  let allDomains = new Set(allTabs.filter(el => el.url).map(tab => hrefToDomain(tab.url)).filter(el => el));
  let domainsToRemove = Object.keys(currentSiteSessions).filter(domain => !allDomains.has(domain));
  if (domainsToRemove.length > 0) {
    console.debug("[GOTS] Removing old sessions: ", domainsToRemove);
    let { previousSessions } = await chrome.storage.local.get("previousSessions");
    domainsToRemove.forEach(domain => {
      // We want to add the session to the previous sessions list, and then remove it from the current sessions list
      if (!previousSessions[domain]) previousSessions[domain] = [];
      currentSiteSessions[domain].endTime = Date.now();
      previousSessions[domain].push(currentSiteSessions[domain]);
      delete currentSiteSessions[domain];
    });
    await chrome.storage.local.set({ currentSiteSessions, previousSessions });
    await Promise.all(domainsToRemove.map(domain => chrome.alarms.clear(domain)));
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

function hrefToDomain(href) {
  let { hostname } = new URL(href);
  if (!hostname) return null;
  let { domain } = psl.parse(decodeURIComponent(hostname));
  return domain;
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
    let domain = hrefToDomain(tab.url);
    if (!domain) return;
    if (!(domain in currentSiteSessions)) {
      console.debug("[GOTS] Initializing new session flow: ", domain);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (frameUrlString, domain, { spent, predicted }) => {
          // We want to create an iframe that will prompt the user to predict how much time they will spend on the site
          let popup = document.createElement("iframe");
          let frameUrl = new URL(frameUrlString);
          frameUrl.searchParams.set("domain", domain);
          frameUrl.searchParams.set("predicted", Math.round(predicted / 1000 / 60));
          frameUrl.searchParams.set("actual", Math.round(spent / 1000 / 60));
          popup.src = frameUrl.toString();
          popup.style.position = "fixed";
          popup.style.top = "50%";
          popup.style.right = "50%";
          popup.style.transform = "translate(50%, -50%)";
          popup.style.zIndex = "10000";
          popup.style.borderRadius = "5px";
          popup.style.border = "none";
          popup.width = "400";
          popup.height = "300";
          // We also want to create a background tint to make the popup stand out
          let backgroundTint = document.body.appendChild(document.createElement("div"));
          backgroundTint.style.position = "fixed";
          backgroundTint.style.top = "0";
          backgroundTint.style.left = "0";
          backgroundTint.style.width = "100vw";
          backgroundTint.style.height = "100vh";
          backgroundTint.style.zIndex = "9999";
          backgroundTint.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
          addEventListener("message", e => {
            if (e.data === "GOTS_CLOSE_IFRAME") {
              popup.remove();
              backgroundTint.remove();
            }
          });
          document.body.appendChild(popup);
          console.log("added");
        },
        args: [chrome.runtime.getURL("/prediction-prompt.html"), domain, calculateAverages(previousSessions[domain])]
      });
    } else if (currentSiteSessions[domain].prediction < Date.now())
      await grayscaleTab(tabId); // If the predicted time has already elapsed, we want to grayscale the tab
  }
});

chrome.tabs.onRemoved.addListener(async () => await removeOldSessions());

// This is the listener for the alarm that is set when a session is started after the user predicts how much time they will spend on the site
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return; // We only want to listen to messages from our extension (not other extensions)
  if (message.type === "startSession" && parseInt(message.prediction) >= 1 && message.domain) {
    let { currentSiteSessions } = await chrome.storage.local.get(["currentSiteSessions"]);
    if (message.domain in currentSiteSessions) return; // If the user has already started a session for this site, we don't want to start another one
    console.debug("[GOTS] Starting session for ", message.domain, " with prediction ", message.prediction);
    let predictionEndMs = Date.now() + parseInt(message.prediction) * 1000 * 60;
    chrome.alarms.create(message.domain, { when: predictionEndMs });
    currentSiteSessions[message.domain] = {
      startTime: Date.now(),
      prediction: predictionEndMs
    };
    chrome.storage.local.set({ currentSiteSessions });
  } else if (message.type === "calculateAverages" && message.previousSessions)
    sendResponse(message.previousSessions.map(a => calculateAverages(a)));
});

// When the user's predicted time alarm goes off, we want to start grayscaling the tabs
chrome.alarms.onAlarm.addListener(async alarm => {
  console.debug("[GOTS] Alarm went off for ", alarm.name, ", grayscaling tabs");
  let allTabs = await chrome.tabs.query({ url: `*://*.${alarm.name}/*` });
  allTabs.forEach(tab => grayscaleTab(tab.id));
});