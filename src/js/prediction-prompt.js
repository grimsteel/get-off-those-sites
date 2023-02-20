const btnSubmit = document.getElementById("submit");
const btnCancel = document.getElementById("cancel");
const inputMinutes = document.getElementById("minutes");
const predictedMinutes = document.getElementById("predicted");
const actualMinutes = document.getElementById("actual");

let params = new URLSearchParams(window.location.search);
let domain = params.get("domain");
let predicted = params.get("predicted");
let actual = params.get("actual");
if (domain) {
  if (predicted !== "0") {
    predictedMinutes.innerText = predicted;
    actualMinutes.innerText = actual;
    predictedMinutes.parentElement.hidden = false;
  }
  inputMinutes.value = predicted;
  btnCancel.addEventListener("click", () =>
    window.parent.postMessage("GOTS_CLOSE_IFRAME", "*")
  );
  btnSubmit.addEventListener("click", async () => {
    if (inputMinutes.reportValidity()) {
      await chrome.runtime.sendMessage({type: "startSession", domain, prediction: inputMinutes.value});
      window.parent.postMessage("GOTS_CLOSE_IFRAME", "*");
    }
  });
}