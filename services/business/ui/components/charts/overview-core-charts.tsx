"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  DoughnutController,
  Tooltip,
  Legend
);

const axisColor = "#475569";
const gridColor = "rgba(148,163,184,0.2)";

export function RuntimeSplitChart({ containerCount, hostCount }: { containerCount: number; hostCount: number }) {
  return (
    <div className="h-[250px]">
      <Doughnut
        data={{
          labels: ["Container", "Host"],
          datasets: [
            {
              data: [containerCount, hostCount],
              backgroundColor: ["#0ea5e9", "#1e293b"],
              borderColor: ["#0369a1", "#0f172a"],
              borderWidth: 1.2,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "60%",
          animation: { duration: 850, animateRotate: true, animateScale: true, easing: "easeOutQuart" },
          plugins: {
            legend: { position: "bottom", labels: { color: axisColor } },
          },
        }}
      />
    </div>
  );
}

export function OsDistributionChart({ labels, values }: { labels: string[]; values: number[] }) {
  return (
    <div className="h-[280px]">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Agents",
              data: values,
              borderRadius: 8,
              backgroundColor: "rgba(37,99,235,0.75)",
              borderColor: "rgba(30,64,175,0.95)",
              borderWidth: 1,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 950,
            easing: "easeOutQuart",
          },
          scales: {
            x: { ticks: { color: axisColor }, grid: { color: gridColor } },
            y: { ticks: { color: axisColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
          },
          plugins: {
            legend: { display: false },
          },
        }}
      />
    </div>
  );
}

export function HeartbeatRecencyChart({
  labels,
  values,
}: {
  labels: string[];
  values: number[];
}) {
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: "easeInOutQuart" },
    scales: {
      x: { ticks: { color: axisColor }, grid: { color: gridColor } },
      y: { ticks: { color: axisColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
    },
    plugins: { legend: { display: false } },
  };

  return (
    <div className="h-[260px]">
      <Line
        data={{
          labels,
          datasets: [
            {
              label: "Agents",
              data: values,
              borderColor: "#0ea5e9",
              backgroundColor: "rgba(14,165,233,0.18)",
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: "#0369a1",
            },
          ],
        }}
        options={options}
      />
    </div>
  );
}

export function RiskDistributionChart({
  labels,
  values,
}: {
  labels: string[];
  values: number[];
}) {
  return (
    <div className="h-[260px]">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Agents",
              data: values,
              borderRadius: 8,
              backgroundColor: [
                "rgba(16,185,129,0.75)",
                "rgba(59,130,246,0.75)",
                "rgba(234,179,8,0.75)",
                "rgba(249,115,22,0.75)",
                "rgba(239,68,68,0.75)",
              ],
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 900, easing: "easeOutQuart" },
          scales: {
            x: { ticks: { color: axisColor }, grid: { color: gridColor } },
            y: { ticks: { color: axisColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
          },
          plugins: { legend: { display: false } },
        }}
      />
    </div>
  );
}

export function ComplianceChart({
  compliant,
  review,
  unknown,
}: {
  compliant: number;
  review: number;
  unknown: number;
}) {
  return (
    <div className="h-[250px]">
      <Doughnut
        data={{
          labels: ["Compliant", "Needs Review", "Unknown"],
          datasets: [
            {
              data: [compliant, review, unknown],
              backgroundColor: ["#22c55e", "#f59e0b", "#94a3b8"],
              borderWidth: 1,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "58%",
          animation: { duration: 900, animateScale: true, animateRotate: true, easing: "easeOutQuart" },
          plugins: {
            legend: { position: "bottom", labels: { color: axisColor } },
          },
        }}
      />
    </div>
  );
}
