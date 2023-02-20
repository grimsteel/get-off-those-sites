const sitesContainer = document.getElementById('sites-container');
const addSiteButton = document.getElementById('add-site-button');
const addSiteInput = document.getElementById('add-site-input');

function createSiteElement(origin, realOrigin, domain, { predicted, spent }) {
  let mediaObject = document.createElement('article');
  mediaObject.classList.add('media');
  let mediaLeft = mediaObject.appendChild(document.createElement('figure'));
  mediaLeft.classList.add('media-left');
  let mediaLeftImage = mediaLeft.appendChild(document.createElement('p'));
  mediaLeftImage.classList.add('image', 'is-64x64');
  let mediaLeftImageImage = mediaLeftImage.appendChild(document.createElement('img'));
  let faviconUrlObj = new URL(chrome.runtime.getURL('/_favicon/'));
  faviconUrlObj.searchParams.set('pageUrl', realOrigin.replace("*.", ""));
  faviconUrlObj.searchParams.set('size', "64");
  mediaLeftImageImage.src = faviconUrlObj.href;
  let mediaContent = mediaObject.appendChild(document.createElement('div'));
  mediaContent.classList.add('media-content');
  let siteName = mediaContent.appendChild(document.createElement('p'));
  siteName.classList.add('has-text-weight-bold');
  siteName.innerText = domain;
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
    urlObj.searchParams.set('domain', domain);
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
  let urlsInfo = origins.map(origin => {
    let { hostname, origin: realOrigin } = new URL(origin);
    let { domain } = psl.parse(decodeURIComponent(hostname).replace("*.", ""));
    return { domain, origin, realOrigin };
  }).filter(({ domain }) => domain); // filter out chrome:// and other non-domain origins
  let sessionAverages = await chrome.runtime.sendMessage({ type: "calculateAverages", previousSessions: urlsInfo.map(({domain}) => previousSessions[domain]) });
  urlsInfo.forEach(({ origin, realOrigin, domain }, i) => {
    let siteElement = createSiteElement(decodeURIComponent(origin), decodeURIComponent(realOrigin), decodeURIComponent(domain), sessionAverages[i] );
    sitesContainer.appendChild(siteElement);
  });
}

void refreshAllowedSites();

addSiteInput.addEventListener("input", () => addSiteInput.setCustomValidity(''));

addSiteButton.addEventListener('click', async () => {
  if (addSiteInput.reportValidity()) {
    let { domain } = psl.parse(addSiteInput.value);
    if (!domain) {
      addSiteInput.setCustomValidity("Please enter a valid domain.");
      addSiteInput.reportValidity();
      return;
    }
    let granted = await chrome.permissions.request({ origins: [`https://*.${domain}/`] })
    if (granted) {
      addSiteInput.value = '';
      await refreshAllowedSites();
    }
  }
});