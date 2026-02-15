"use client";

import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type Plugin,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const depthShadowPlugin: Plugin<"doughnut"> = {
  id: "depthShadowDoughnut",
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore();
  },
};

export function AgentsStatusDoughnut({
  connected,
  stale,
  disconnected,
}: {
  connected: number;
  stale: number;
  disconnected: number;
}) {
  const values = [connected, stale, disconnected];
  const total = values.reduce((acc, cur) => acc + cur, 0);

  const data = {
    labels: ["Connected", "Stale", "Disconnected"],
    datasets: [
      {
        data: values,
        backgroundColor: ["#22c55e", "#f59e0b", "#64748b"],
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1200,
      easing: "easeOutQuart",
      delay(ctx) {
        return ctx.type === "data" ? ctx.dataIndex * 80 : 0;
      },
    },
    animations: {
      backgroundColor: {
        duration: 900,
        easing: "easeInOutQuad",
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#334155",
          boxWidth: 10,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<"doughnut">) => {
            const v = Number(ctx.parsed || 0);
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
            return `${ctx.label}: ${v} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="h-[260px] w-full">
      <Doughnut data={data} options={options} plugins={[depthShadowPlugin]} />
    </div>
  );
}
