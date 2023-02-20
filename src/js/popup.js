const addedContainer = document.getElementById('added-container');
const notAddedContainer = document.getElementById('not-added-container');
const addSiteButton = document.getElementById('btn-add');
const predictedMinutes = document.getElementById('predicted');
const actualMinutes = document.getElementById('actual');
const statsLink = document.getElementById('stats-link');

Promise.all([
  chrome.storage.local.get("previousSessions"),
  chrome.tabs.query({ currentWindow: true, active: true })])
.then(([{ previousSessions }, [ currentTab ]]) => {
  if (currentTab && currentTab.url) {
    let { hostname } = new URL(currentTab.url);
    let { domain } = psl.parse(hostname);
    if (!domain) return;
    addedContainer.hidden = false;
    chrome.runtime.sendMessage({ type: "calculateAverages", previousSessions: [ previousSessions[domain] ] }).then(([ { predicted, spent } ]) => {
      if (predicted > 0) {
        predictedMinutes.parentElement.hidden = false;
        predictedMinutes.innerText = Math.round(predicted / 1000 / 60);;
        actualMinutes.innerText = Math.round(spent / 1000 / 60);
        statsLink.hidden = false;
        const statsUrlObj = new URL(chrome.runtime.getURL('/stats.html'));
        statsUrlObj.searchParams.set('domain', domain);
        statsLink.href = statsUrlObj.href;
      }
    });
  } else
    notAddedContainer.hidden = false;
});