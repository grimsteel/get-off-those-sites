import { Chart } from "./bar-chart.js";

const statsContainer = document.getElementById('stats-container');
const noStatsContainer = document.getElementById('no-stats-container');
const domainField = document.getElementById("field-domain");
const statsChart = document.getElementById("stats-chart");
const statsTableBody = document.getElementById("stats-table-body");
const btnExportCsv = document.getElementById("btn-export-csv");
const btnExportJson = document.getElementById("btn-export-json");

async function saveFile(name, extension, description, type, contents) {
  // use the File System Access API to save a file
  const handle = await window.showSaveFilePicker({
    suggestedName: name,
    types: [
      {
        description,
        accept: {
          [type]: [extension]
        }
      }
    ]
  });
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();          
}

const domain = new URLSearchParams(window.location.search).get("domain");
if (domain) {
  const { previousSessions } = await chrome.storage.local.get("previousSessions");
  let prev = previousSessions[domain];
  if (prev && prev.length > 0) {
    statsContainer.hidden = false;
    domainField.innerText = domain;
    let chartData = {
      labels: [],
      datasets: [
        {
          label: "Predicted",
          borderWidth: 1,
          data: []
        },
        {
          label: "Actual",
          borderWidth: 1,
          data: []
        }
      ]
    };
    prev.forEach(({ startTime, endTime, prediction }) => {
      // Create the table rows and start constructing the chart data while we're at it
      let tableRow = statsTableBody.appendChild(document.createElement("tr"));
      let startTimeCell = tableRow.appendChild(document.createElement("td"));
      let endTimeCell = tableRow.appendChild(document.createElement("td"));
      let predictionCell = tableRow.appendChild(document.createElement("td"));
      let actualCell = tableRow.appendChild(document.createElement("td"));
      startTimeCell.innerText = new Date(startTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
      endTimeCell.innerText = new Date(endTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
      let predictionMinutes = Math.round((prediction - startTime) / 1000 / 60);
      let actualMinutes = Math.round((endTime - startTime) / 1000 / 60);
      predictionCell.innerText = predictionMinutes;
      actualCell.innerText = actualMinutes;
      chartData.labels.push(startTimeCell.innerText);
      chartData.datasets[0].data.push(predictionMinutes);
      chartData.datasets[1].data.push(actualMinutes);
    });
    // Render the chart
    new Chart(statsChart, {
      type: "bar",
      data: chartData,
      
    });
    btnExportCsv.addEventListener("click", () => {
      let csv = prev.reduce(
        (acc, { startTime, endTime, prediction }) =>
          acc + `\n${new Date(startTime).toUTCString()},${new Date(endTime).toUTCString()},${Math.round((prediction - startTime) / 1000 / 60)},${endTime - startTime}`,
        "start,end,prediction_min,actual_ms"
      );
      saveFile(`${domain}-stats.csv`, ".csv", "Comma Separated Values files", "text/csv", csv);
    });
    btnExportJson.addEventListener("click", () => 
      saveFile(`${domain}-stats.json`, ".json", "JavaScript Object Notation files", "application/json", JSON.stringify(prev.map(({ startTime, endTime, prediction }) => ({
        start: new Date(startTime).toUTCString(),
        end: new Date(endTime).toUTCString(),
        predictionMinutes: Math.round((prediction - startTime) / 1000 / 60),
        actualMilliseconds: endTime - startTime
      }))))
    );
  } else {
    noStatsContainer.hidden = false; // Show a message saying there are no stats for this site
  }
} else
  noStatsContainer.hidden = false;