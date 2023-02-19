document.getElementById("btn-add-common").addEventListener("click", async () => {
  let granted = await chrome.permissions.request({ origins: [
    "https://www.youtube.com/*",
    "https://www.facebook.com/*",
    "https://www.instagram.com/*",
    "https://www.reddit.com/*",
    "https://www.twitter.com/*",
    "https://www.tiktok.com/*"
  ]});
  if (granted) window.close();
});