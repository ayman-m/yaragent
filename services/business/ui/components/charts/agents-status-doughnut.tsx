"use client";

import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

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
        borderColor: ["#14532d", "#78350f", "#1e293b"],
        borderWidth: 1.2,
        hoverOffset: 6,
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
      duration: 900,
      easing: "easeOutQuart",
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#cbd5e1",
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
      <Doughnut data={data} options={options} />
    </div>
  );
}
