document.getElementById("btn-add-common").addEventListener("click", async () => {
  let granted = await chrome.permissions.request({ origins: [
    "https://*.youtube.com/*",
    "https://*.facebook.com/*",
    "https://*.instagram.com/*",
    "https://*.reddit.com/*",
    "https://*.twitter.com/*",
    "https://*.tiktok.com/*"
  ]});
  if (granted) window.close();
});