chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install")
    chrome.storage.local.set({ averageTimeSpent: {}, currentSiteSessions: {} });
});