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

const axisColor = "#495057";
const gridColor = "rgba(206,212,218,0.35)";
const colorInfo = "#1A73E8";
const colorSuccess = "#43A047";
const colorWarning = "#FB8C00";
const colorError = "#E53935";
const colorSecondaryDark = "#495361";
const colorDark = "#344767";

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
              backgroundColor: [colorInfo, colorDark],
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
                getBarGradient(ctx.chart, "rgba(73,163,241,0.65)", "rgba(26,115,232,0.95)"),
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
              borderColor: colorInfo,
              backgroundColor: "rgba(73,163,241,0.2)",
              fill: true,
              tension: 0.35,
              pointRadius: 3,
              pointBackgroundColor: colorInfo,
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
                  ["rgba(102,187,106,0.6)", "#43A047"],
                  ["rgba(73,163,241,0.6)", "#1A73E8"],
                  ["rgba(255,167,38,0.6)", "#FB8C00"],
                  ["rgba(239,83,80,0.6)", "#E53935"],
                  ["rgba(116,123,138,0.58)", "#495361"],
                ];
                const pair = colorPairs[ctx.dataIndex] || ["rgba(116,123,138,0.58)", "#495361"];
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
              backgroundColor: [colorSuccess, colorWarning, colorSecondaryDark],
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
                  ["rgba(239,83,80,0.65)", colorError],
                  ["rgba(251,140,0,0.65)", "#FB8C00"],
                  ["rgba(73,163,241,0.6)", colorInfo],
                  ["rgba(116,123,138,0.6)", colorSecondaryDark],
                ];
                const pair = colorPairs[ctx.dataIndex] || ["rgba(116,123,138,0.6)", colorSecondaryDark];
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
              backgroundColor: [colorInfo, colorSuccess],
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
              backgroundColor: (ctx) => getBarGradient(ctx.chart, "rgba(116,123,138,0.65)", "rgba(73,83,97,0.95)"),
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
              backgroundColor: (ctx) => getBarGradient(ctx.chart, "rgba(102,187,106,0.65)", "rgba(67,160,71,0.95)"),
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
