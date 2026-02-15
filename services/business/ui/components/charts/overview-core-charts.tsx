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
const slateBlue = "#1d4ed8";
const slateBlueDark = "#1e3a8a";
const emeraldDark = "#047857";
const emeraldDeeper = "#065f46";
const amberDark = "#b45309";
const amberDeeper = "#92400e";
const roseDark = "#be123c";
const roseDeeper = "#9f1239";
const slateDark = "#334155";
const slateDeeper = "#1e293b";

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
              backgroundColor: [slateBlue, slateDark],
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
                getBarGradient(ctx.chart, "rgba(30,58,138,0.55)", "rgba(29,78,216,0.9)"),
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
              borderColor: slateBlue,
              backgroundColor: "rgba(30,58,138,0.2)",
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: slateBlueDark,
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
              backgroundColor: (ctx) => {
                const colorPairs: [string, string][] = [
                  ["rgba(6,95,70,0.5)", emeraldDark],
                  ["rgba(30,58,138,0.5)", slateBlue],
                  ["rgba(146,64,14,0.5)", amberDark],
                  ["rgba(154,52,18,0.55)", amberDeeper],
                  ["rgba(136,19,55,0.55)", roseDark],
                ];
                const pair = colorPairs[ctx.dataIndex] || ["rgba(30,58,138,0.5)", slateBlue];
                return getBarGradient(ctx.chart, pair[0], pair[1]);
              },
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
              backgroundColor: [emeraldDark, amberDark, slateDark],
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

export function FindingsSeverityMixChart({
  critical,
  high,
  medium,
  low,
}: {
  critical: number;
  high: number;
  medium: number;
  low: number;
}) {
  return (
    <div className="h-[260px]">
      <Bar
        data={{
          labels: ["Critical", "High", "Medium", "Low"],
          datasets: [
            {
              label: "CVEs",
              data: [critical, high, medium, low],
              borderRadius: 10,
              backgroundColor: (ctx) => {
                const colorPairs: [string, string][] = [
                  ["rgba(159,18,57,0.6)", roseDark],
                  ["rgba(190,24,93,0.55)", roseDeeper],
                  ["rgba(146,64,14,0.55)", amberDark],
                  ["rgba(30,58,138,0.5)", slateBlue],
                ];
                const pair = colorPairs[ctx.dataIndex] || ["rgba(30,58,138,0.5)", slateBlue];
                return getBarGradient(ctx.chart, pair[0], pair[1]);
              },
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
              return ctx.type === "data" ? ctx.dataIndex * 65 : 0;
            },
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

export function OpenResolvedDetectionsChart({ open, resolved }: { open: number; resolved: number }) {
  return (
    <div className="h-[250px]">
      <Doughnut
        data={{
          labels: ["Open", "Resolved"],
          datasets: [
            {
              data: [open, resolved],
              backgroundColor: [slateBlueDark, emeraldDeeper],
              borderWidth: 0,
              hoverOffset: 10,
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
              return ctx.type === "data" ? ctx.dataIndex * 90 : 0;
            },
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

export function TopVulnerablePackagesChart({ labels, values }: { labels: string[]; values: number[] }) {
  return (
    <div className="h-[300px]">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "CVEs",
              data: values,
              borderRadius: 8,
              backgroundColor: (ctx) => getBarGradient(ctx.chart, "rgba(15,23,42,0.55)", "rgba(30,58,138,0.9)"),
              borderWidth: 0,
            },
          ],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 1150,
            easing: "easeOutQuart",
            delay(ctx) {
              return ctx.type === "data" ? ctx.dataIndex * 45 : 0;
            },
          },
          scales: {
            x: { ticks: { color: axisColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
            y: { ticks: { color: axisColor }, grid: { display: false } },
          },
          plugins: { legend: { display: false } },
        }}
        plugins={[depthShadowPlugin]}
      />
    </div>
  );
}

export function PackageInventorySizeChart({ labels, values }: { labels: string[]; values: number[] }) {
  return (
    <div className="h-[300px]">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Packages",
              data: values,
              borderRadius: 8,
              backgroundColor: (ctx) => getBarGradient(ctx.chart, "rgba(6,95,70,0.45)", "rgba(4,120,87,0.9)"),
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 1100,
            easing: "easeOutQuart",
            delay(ctx) {
              return ctx.type === "data" ? ctx.dataIndex * 40 : 0;
            },
          },
          scales: {
            x: { ticks: { color: axisColor }, grid: { display: false } },
            y: { ticks: { color: axisColor, precision: 0 }, grid: { color: gridColor }, beginAtZero: true },
          },
          plugins: { legend: { display: false } },
        }}
        plugins={[depthShadowPlugin]}
      />
    </div>
  );
}
