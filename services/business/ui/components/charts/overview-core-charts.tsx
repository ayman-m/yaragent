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
  type Plugin,
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

const depthShadowPlugin: Plugin = {
  id: "depthShadow",
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.14)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 7;
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore();
  },
};

function getBarGradient(chart: ChartJS, from: string, to: string) {
  const area = chart.chartArea;
  if (!area) return from;
  const gradient = chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  return gradient;
}

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
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "60%",
          animation: {
            duration: 1200,
            animateRotate: true,
            animateScale: true,
            easing: "easeOutQuart",
            delay(ctx) {
              return ctx.type === "data" ? ctx.dataIndex * 90 : 0;
            },
          },
          animations: {
            backgroundColor: { duration: 900, easing: "easeInOutQuad" },
          },
          plugins: {
            legend: { position: "bottom", labels: { color: axisColor } },
          },
        }}
        plugins={[depthShadowPlugin]}
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
              backgroundColor: (ctx) =>
                getBarGradient(ctx.chart, "rgba(59,130,246,0.48)", "rgba(37,99,235,0.88)"),
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 1200,
            easing: "easeOutQuart",
            delay(ctx) {
              return ctx.type === "data" ? ctx.dataIndex * 55 : 0;
            },
          },
          animations: {
            y: { duration: 1000, easing: "easeOutCubic" },
          },
          scales: {
            x: { ticks: { color: axisColor }, grid: { color: gridColor } },
            y: { ticks: { color: axisColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
          },
          plugins: {
            legend: { display: false },
          },
        }}
        plugins={[depthShadowPlugin]}
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
    animation: {
      duration: 1250,
      easing: "easeInOutQuart",
      delay(ctx) {
        return ctx.type === "data" ? ctx.dataIndex * 35 : 0;
      },
    },
    animations: {
      y: { duration: 1000, easing: "easeOutCubic" },
      tension: { duration: 900, easing: "easeInOutQuad" },
    },
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
              borderWidth: 2.4,
            },
          ],
        }}
        options={options}
        plugins={[depthShadowPlugin]}
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
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 1200,
            easing: "easeOutQuart",
            delay(ctx) {
              return ctx.type === "data" ? ctx.dataIndex * 50 : 0;
            },
          },
          animations: {
            y: { duration: 1000, easing: "easeOutCubic" },
          },
          scales: {
            x: { ticks: { color: axisColor }, grid: { color: gridColor } },
            y: { ticks: { color: axisColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
          },
          plugins: { legend: { display: false } },
        }}
        plugins={[depthShadowPlugin]}
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
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "58%",
          animation: {
            duration: 1200,
            animateScale: true,
            animateRotate: true,
            easing: "easeOutQuart",
            delay(ctx) {
              return ctx.type === "data" ? ctx.dataIndex * 80 : 0;
            },
          },
          animations: {
            backgroundColor: { duration: 900, easing: "easeInOutQuad" },
          },
          plugins: {
            legend: { position: "bottom", labels: { color: axisColor } },
          },
        }}
        plugins={[depthShadowPlugin]}
      />
    </div>
  );
}
