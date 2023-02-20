const sitesContainer = document.getElementById('sites-container');
const addSiteButton = document.getElementById('add-site-button');
const addSiteInput = document.getElementById('add-site-input');

function createSiteElement(origin, realOrigin, host, { predicted, spent }) {
  let mediaObject = document.createElement('article');
  mediaObject.classList.add('media');
  let mediaLeft = mediaObject.appendChild(document.createElement('figure'));
  mediaLeft.classList.add('media-left');
  let mediaLeftImage = mediaLeft.appendChild(document.createElement('p'));
  mediaLeftImage.classList.add('image', 'is-64x64');
  let mediaLeftImageImage = mediaLeftImage.appendChild(document.createElement('img'));
  let faviconUrlObj = new URL(chrome.runtime.getURL('/_favicon/'));
  faviconUrlObj.searchParams.set('pageUrl', realOrigin);
  faviconUrlObj.searchParams.set('size', "64");
  mediaLeftImageImage.src = faviconUrlObj.href;
  let mediaContent = mediaObject.appendChild(document.createElement('div'));
  mediaContent.classList.add('media-content');
  let siteName = mediaContent.appendChild(document.createElement('p'));
  siteName.classList.add('has-text-weight-bold');
  siteName.innerText = realOrigin;
  let siteTime = mediaContent.appendChild(document.createElement('p'));
  siteTime.innerText = predicted ? 
    `You think you'll spend ${Math.round(predicted / 1000 / 60)} minutes on this site, but you really spend ${Math.round(spent / 1000 / 60)} minutes.` : 
    "We don't have any data on this site yet.";
  if (predicted) {
    // include a link to /stats.html
    let siteStatsLink = mediaContent.appendChild(document.createElement('a'));
    siteStatsLink.innerText = "More >";
    siteStatsLink.classList.add("button", "is-small", "is-info", "mt-1");
    let urlObj = new URL(chrome.runtime.getURL('/stats.html'));
    urlObj.searchParams.set('host', host);
    siteStatsLink.href = urlObj.href;
  }
  let mediaRight = mediaObject.appendChild(document.createElement('div'));
  mediaRight.classList.add('media-right');
  let deleteButton = mediaRight.appendChild(document.createElement('button'));
  deleteButton.classList.add('delete');
  deleteButton.addEventListener('click', async () => {
    let removed = await chrome.permissions.remove({ origins: [origin] });
    if (removed) mediaObject.remove();
  });
  return mediaObject;
}

async function refreshAllowedSites() {
  let [{ origins }, { previousSessions }] = await Promise.all([chrome.permissions.getAll(), chrome.storage.local.get("previousSessions")]);
  sitesContainer.textContent = '';
  let sessionAverages = await chrome.runtime.sendMessage({ type: "calculateAverages", previousSessions: origins.map(origin => {
    let { host } = new URL(origin);
    return previousSessions[host];
  }) });
  origins.forEach((origin, i) => {
    let {  origin: realOrigin, host } = new URL(origin);
    let siteElement = createSiteElement(origin, realOrigin, host, sessionAverages[i] );
    sitesContainer.appendChild(siteElement);
  });
}

void refreshAllowedSites();

addSiteButton.addEventListener('click', async () => {
  if (addSiteInput.reportValidity()) {
    let { origin } = new URL(addSiteInput.value);
    let granted = await chrome.permissions.request({ origins: [origin + "/"] })
    if (granted) {
      addSiteInput.value = '';
      await refreshAllowedSites();
    }
  }
});