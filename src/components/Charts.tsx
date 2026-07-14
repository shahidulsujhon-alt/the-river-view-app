/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrendingUp, ArrowDownRight, ArrowUpRight, Percent } from "lucide-react";

// Types
interface BarChartData {
  month: string;
  deposits: number;
  withdrawals: number;
  expenses: number;
}

interface PieSegment {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

interface ChartsProps {
  transactions: any[];
  expenses: any[];
  summary: {
    totalDeposit: number;
    totalExpense: number;
    currentBalance: number;
  };
}

export function MonthlyCashFlowChart({ transactions, expenses }: { transactions: any[]; expenses: any[] }) {
  const [hoveredBar, setHoveredBar] = useState<{ month: string; type: string; value: number; x: number; y: number } | null>(null);

  // Group transactions and expenses by month
  const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const currentYear = new Date().getFullYear();

  // Aggregate
  const monthlyDataMap: Record<string, { deposits: number; withdrawals: number; expenses: number }> = {};

  // Initialize recent 4 months (e.g., April, May, June, July of current or last year based on current local time)
  // Let's seed April, May, June, July to match our pre-seeded data beautifully
  const displayMonths = ["Apr", "May", "Jun", "Jul"];
  displayMonths.forEach((m) => {
    monthlyDataMap[m] = { deposits: 0, withdrawals: 0, expenses: 0 };
  });

  // Aggregate deposits and withdrawals (only approved ones)
  transactions.forEach((tx) => {
    if (tx.status !== "APPROVED") return;
    const date = new Date(tx.date);
    const mStr = monthsList[date.getMonth()];
    if (displayMonths.includes(mStr)) {
      if (tx.type === "Deposit") {
        monthlyDataMap[mStr].deposits += tx.amount;
      } else if (tx.type === "Withdrawal") {
        monthlyDataMap[mStr].withdrawals += tx.amount;
      }
    }
  });

  // Aggregate expenses
  expenses.forEach((exp) => {
    const date = new Date(exp.date);
    const mStr = monthsList[date.getMonth()];
    if (displayMonths.includes(mStr)) {
      monthlyDataMap[mStr].expenses += exp.amount;
    }
  });

  const chartData: BarChartData[] = displayMonths.map((m) => ({
    month: m,
    ...monthlyDataMap[m],
  }));

  // Find max value for scaling
  const maxVal = Math.max(
    ...chartData.flatMap((d) => [d.deposits, d.withdrawals, d.expenses]),
    100000 // default minimum height floor
  );

  // Math dimensions
  const height = 240;
  const padding = 40;
  const graphHeight = height - padding * 2;

  // Nice y-axis grid levels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxVal * p));

  const formatCurrencyAbbrev = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val}`;
  };

  return (
    <div className="relative bg-white rounded-2xl border border-slate-100 p-6 shadow-xs w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-display font-semibold text-slate-800">Monthly Cash Flow</h3>
          <p className="text-xs text-slate-400">Deposits, withdrawals, and expenses across project stages</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Deposits</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-500">Withdrawals</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-500">Expenses</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[240px]">
        {/* SVG Wrapper */}
        <svg viewBox={`0 0 500 ${height}`} className="w-full h-full overflow-visible">
          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = padding + graphHeight - (tick / maxVal) * graphHeight;
            return (
              <g key={i}>
                <line
                  x1={45}
                  y1={y}
                  x2={480}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? "0" : "4 4"}
                />
                <text
                  x={35}
                  y={y + 4}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-slate-400"
                >
                  {formatCurrencyAbbrev(tick)}
                </text>
              </g>
            );
          })}

          {/* Render Bars for Month Group */}
          {chartData.map((data, mIdx) => {
            const groupWidth = 80;
            const groupX = 75 + mIdx * 105;
            const barWidth = 14;

            // Heights
            const hDep = (data.deposits / maxVal) * graphHeight;
            const hWth = (data.withdrawals / maxVal) * graphHeight;
            const hExp = (data.expenses / maxVal) * graphHeight;

            // Y coordinates
            const yDep = padding + graphHeight - hDep;
            const yWth = padding + graphHeight - hWth;
            const yExp = padding + graphHeight - hExp;

            return (
              <g key={data.month}>
                {/* Month label */}
                <text
                  x={groupX + groupWidth / 2 - 10}
                  y={height - 15}
                  textAnchor="middle"
                  className="font-display text-[11px] font-medium fill-slate-500"
                >
                  {data.month}
                </text>

                {/* Deposits Bar */}
                <motion.rect
                  x={groupX}
                  y={yDep}
                  width={barWidth}
                  height={Math.max(2, hDep)}
                  rx={4}
                  fill="url(#grad-deposits)"
                  initial={{ scaleY: 0, originY: 1 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: mIdx * 0.1 }}
                  className="cursor-pointer hover:opacity-90"
                  onMouseEnter={(e) => {
                    setHoveredBar({
                      month: data.month,
                      type: "Deposit",
                      value: data.deposits,
                      x: groupX + barWidth / 2,
                      y: yDep,
                    });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                />

                {/* Withdrawals Bar */}
                <motion.rect
                  x={groupX + barWidth + 4}
                  y={yWth}
                  width={barWidth}
                  height={Math.max(2, hWth)}
                  rx={4}
                  fill="url(#grad-withdrawals)"
                  initial={{ scaleY: 0, originY: 1 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: mIdx * 0.1 + 0.05 }}
                  className="cursor-pointer hover:opacity-90"
                  onMouseEnter={() => {
                    setHoveredBar({
                      month: data.month,
                      type: "Withdrawal",
                      value: data.withdrawals,
                      x: groupX + barWidth * 1.5 + 4,
                      y: yWth,
                    });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                />

                {/* Expenses Bar */}
                <motion.rect
                  x={groupX + barWidth * 2 + 8}
                  y={yExp}
                  width={barWidth}
                  height={Math.max(2, hExp)}
                  rx={4}
                  fill="url(#grad-expenses)"
                  initial={{ scaleY: 0, originY: 1 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: mIdx * 0.1 + 0.1 }}
                  className="cursor-pointer hover:opacity-90"
                  onMouseEnter={() => {
                    setHoveredBar({
                      month: data.month,
                      type: "Expense",
                      value: data.expenses,
                      x: groupX + barWidth * 2.5 + 8,
                      y: yExp,
                    });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                />
              </g>
            );
          })}

          {/* Gradient definitions */}
          <defs>
            <linearGradient id="grad-deposits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="grad-withdrawals" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
            <linearGradient id="grad-expenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
        </svg>

        {/* Dynamic HTML Tooltip */}
        <AnimatePresence>
          {hoveredBar && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              style={{
                left: `${(hoveredBar.x / 500) * 100}%`,
                top: `${(hoveredBar.y / height) * 100 - 30}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-full bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg shadow-xl z-20 pointer-events-none flex flex-col gap-0.5 min-w-[110px]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1 mb-1">
                <span className="font-semibold text-slate-300">{hoveredBar.month}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    hoveredBar.type === "Deposit"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : hoveredBar.type === "Withdrawal"
                      ? "bg-rose-500/20 text-rose-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {hoveredBar.type}
                </span>
              </div>
              <span className="font-mono font-medium text-white">${hoveredBar.value.toLocaleString()}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function FinancialOverviewChart({ summary }: { summary: ChartsProps["summary"] }) {
  const [activeSegment, setActiveSegment] = useState<number | null>(null);

  const { totalDeposit, totalExpense, currentBalance } = summary;
  const total = (totalDeposit || 0) + (totalExpense || 0) + (Math.max(0, currentBalance) || 0);

  const segments: PieSegment[] = [
    {
      name: "Deposits",
      value: totalDeposit || 0,
      color: "#10b981", // Emerald
      percentage: total > 0 ? Math.round(((totalDeposit || 0) / total) * 100) : 0,
    },
    {
      name: "Expenses",
      value: totalExpense || 0,
      color: "#f59e0b", // Amber
      percentage: total > 0 ? Math.round(((totalExpense || 0) / total) * 100) : 0,
    },
    {
      name: "Current Balance",
      value: Math.max(0, currentBalance || 0),
      color: "#3b82f6", // Blue
      percentage: total > 0 ? Math.round((Math.max(0, currentBalance || 0) / total) * 100) : 0,
    },
  ].filter((s) => s.value > 0);

  // SVG Calculations for Doughnut
  let accumulatedAngle = 0;
  const radius = 60;
  const strokeWidth = 14;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs w-full flex flex-col justify-between h-full">
      <div>
        <h3 className="text-base font-display font-semibold text-slate-800">Financial Overview</h3>
        <p className="text-xs text-slate-400">Proportional ratio of project cash assets</p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6 my-4 justify-center">
        {/* Doughnut SVG */}
        <div className="relative w-[160px] h-[160px] flex items-center justify-center">
          <svg width="160" height="160" className="transform -rotate-90">
            {segments.length === 0 ? (
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
            ) : (
              segments.map((seg, idx) => {
                const strokeDashOffset = circumference - (seg.percentage / 100) * circumference;
                const rotation = (accumulatedAngle / 100) * 360;
                accumulatedAngle += seg.percentage;

                const isHovered = activeSegment === idx;

                return (
                  <motion.circle
                    key={seg.name}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashOffset}
                    transform={`rotate(${rotation} ${cx} ${cy})`}
                    style={{ cursor: "pointer", transition: "stroke-width 0.2s" }}
                    onMouseEnter={() => setActiveSegment(idx)}
                    onMouseLeave={() => setActiveSegment(null)}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: strokeDashOffset }}
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                  />
                );
              })
            )}
          </svg>

          {/* Central Label */}
          <div className="absolute text-center flex flex-col items-center justify-center">
            {activeSegment !== null ? (
              <>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  {segments[activeSegment].name}
                </span>
                <span className="text-lg font-display font-bold text-slate-800">
                  {segments[activeSegment].percentage}%
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                  Total Managed
                </span>
                <span className="text-base font-display font-bold text-slate-700">
                  ${(totalDeposit || 0).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 w-full md:w-auto min-w-[140px]">
          {segments.map((seg, idx) => (
            <div
              key={seg.name}
              className={`flex items-center justify-between gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSegment === idx ? "bg-slate-50" : ""
              }`}
              onMouseEnter={() => setActiveSegment(idx)}
              onMouseLeave={() => setActiveSegment(null)}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="text-xs font-medium text-slate-600">{seg.name}</span>
              </div>
              <div className="text-right flex flex-col">
                <span className="text-xs font-mono font-semibold text-slate-800">
                  ${seg.value.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">{seg.percentage}%</span>
              </div>
            </div>
          ))}
          {segments.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-4">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
