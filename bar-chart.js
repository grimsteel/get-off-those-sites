import { Chart, BarController, BarElement, CategoryScale, LinearScale, Legend, Colors } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Legend, Colors);

export { Chart };