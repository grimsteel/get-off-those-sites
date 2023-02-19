const addedContainer = document.getElementById('added-container');
const notAddedContainer = document.getElementById('not-added-container');
const addSiteButton = document.getElementById('btn-add');
const predictedMinutes = document.getElementById('predicted');
const actualMinutes = document.getElementById('actual');

Promise.all([chrome.permissions.getAll(), chrome.storage.local.get("averageTimeSpent"), chrome.tabs.query({ currentWindow: true, active: true })]).then(([{ origins }, { averageTimeSpent }, [ currentTab ]]) => {
  if (currentTab && currentTab.url) {
    let { origin: currentOrigin, host } = new URL(currentTab.url);
    if (origins.includes(currentOrigin + "/*")) {
      addedContainer.hidden = false;
      if (averageTimeSpent[host]) {
        predictedMinutes.parentElement.hidden = false;
        predictedMinutes.innerText = averageTimeSpent[host].predicted;
        actualMinutes.innerText = Math.round(averageTimeSpent[host].spent / 1000 / 60);
      }
    } else {
      notAddedContainer.hidden = false;
      addSiteButton.addEventListener('click', async () => {
        let granted = await chrome.permissions.request({ origins: [currentOrigin + "/"] })
        if (granted) {
          window.close();
        }
      });
    }
  }
});