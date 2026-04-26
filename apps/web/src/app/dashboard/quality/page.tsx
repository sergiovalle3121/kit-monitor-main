"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertOctagon,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Filter,
  MoreVertical,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type {
  NCR,
  NcrSeverity,
  NcrSeverityFilter,
  NcrStatus,
  NcrStatusFilter,
  QualityInspection,
} from "./quality.types";
import { calculateFirstPassYield } from "./quality.utils";

const ncrSeverities: NcrSeverity[] = ["Critical", "High", "Medium", "Low"];
const ncrStatuses: NcrStatus[] = ["Open", "Under Review", "Contained", "Closed"];

const mockNCRs: NCR[] = [
  {
    id: "NCR-2026-001",
    partNumber: "AX-Main-Chassis",
    issue: "Dimensional Deviation",
    status: "Open",
    severity: "High",
    rootCause: "Fixture drift during final torque sequence",
    createdAt: "2h ago",
    owner: "QA Engineering",
  },
  {
    id: "NCR-2026-002",
    partNumber: "AX-Cable-Harness",
    issue: "Insulation Breach",
    status: "Under Review",
    severity: "Critical",
    rootCause: "Pending containment analysis",
    createdAt: "5h ago",
    owner: "Supplier Quality",
  },
  {
    id: "NCR-2026-003",
    partNumber: "AX-Sensor-Array",
    issue: "Calibration Failure",
    status: "Closed",
    severity: "Medium",
    rootCause: "Outdated calibration profile",
    closureDate: "2026-04-24",
    createdAt: "1d ago",
    owner: "Test Engineering",
  },
  {
    id: "NCR-2026-004",
    partNumber: "Steel Plate 4x8",
    issue: "Surface Oxidation",
    status: "Open",
    severity: "Low",
    rootCause: "Packaging moisture exposure",
    createdAt: "2d ago",
    owner: "Incoming Quality",
  },
];

const mockInspections: QualityInspection[] = [
  { id: "IQC-2026-0191", inspectedQuantity: 120, passedQuantity: 118, result: "pass" },
  { id: "OQC-2026-2204", inspectedQuantity: 80, passedQuantity: 80, result: "pass" },
  { id: "OQC-2026-2205", inspectedQuantity: 60, passedQuantity: 55, result: "conditional" },
];

const severityStyles: Record<NcrSeverity, string> = {
  Critical: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  High: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  Medium: "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400",
  Low: "bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-300",
};

const statusStyles: Record<NcrStatus, string> = {
  Open: "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  "Under Review": "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  Contained: "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300",
  Closed: "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400",
};

const QualityMetric = ({
  title,
  value,
  change,
  trend,
}: {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
}) => (
  <div className="bg-white dark:bg-[#111] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</h4>
      <div className={`flex items-center gap-1 text-[10px] font-bold ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
        {change}
        <ArrowUpRight className="w-3 h-3" />
      </div>
    </div>
    <p className="text-3xl font-bold tracking-tight">{value}</p>
  </div>
);

export default function QualityCenterPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<NcrSeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<NcrStatusFilter>("all");

  const firstPassYield = calculateFirstPassYield(mockInspections);
  const activeNcrCount = mockNCRs.filter((ncr) => ncr.status !== "Closed").length;

  const filteredNCRs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mockNCRs.filter((ncr) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        ncr.id.toLowerCase().includes(normalizedSearch) ||
        ncr.partNumber.toLowerCase().includes(normalizedSearch) ||
        ncr.issue.toLowerCase().includes(normalizedSearch);
      const matchesSeverity = severityFilter === "all" || ncr.severity === severityFilter;
      const matchesStatus = statusFilter === "all" || ncr.status === statusFilter;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [searchTerm, severityFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm hover:scale-105 active:scale-95 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              <h1 className="text-4xl font-bold tracking-tight">Quality Center</h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-light">Total quality management and non-conformance tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-medium hover:bg-white dark:hover:bg-white/5 transition-all flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Inspection Plan
          </button>
          <button className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New NCR
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <QualityMetric title="First Pass Yield" value={`${firstPassYield}%`} change="+0.8%" trend="up" />
        <QualityMetric title="Active NCRs" value={String(activeNcrCount)} change="-2" trend="up" />
        <QualityMetric title="Defect Rate" value="0.24%" change="-0.05%" trend="up" />
        <QualityMetric title="Avg Closure Time" value="1.4d" change="+0.2d" trend="down" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-8">
              <h3 className="text-xl font-bold tracking-tight">NCR Tracking</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search NCR..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:ring-1 focus:ring-black/10 transition-all"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <select
                    value={severityFilter}
                    onChange={(event) => setSeverityFilter(event.target.value as NcrSeverityFilter)}
                    className="w-full appearance-none bg-gray-50 dark:bg-white/5 rounded-xl py-2 pl-9 pr-8 text-xs font-bold outline-none focus:ring-1 focus:ring-black/10 transition-all"
                  >
                    <option value="all">All Severities</option>
                    {ncrSeverities.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as NcrStatusFilter)}
                  className="appearance-none bg-gray-50 dark:bg-white/5 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-1 focus:ring-black/10 transition-all"
                >
                  <option value="all">All Statuses</option>
                  {ncrStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              {filteredNCRs.map((ncr) => (
                <motion.div
                  key={ncr.id}
                  whileHover={{ x: 4 }}
                  className="flex items-center justify-between p-5 rounded-2xl bg-gray-50/50 dark:bg-white/[0.02] border border-transparent hover:border-gray-100 dark:hover:border-white/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${severityStyles[ncr.severity]}`}>
                      <AlertOctagon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{ncr.id}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusStyles[ncr.status]}`}>
                          {ncr.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        {ncr.partNumber} - <span className="text-gray-400 font-light">{ncr.issue}</span>
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium mt-1">
                        Root cause: {ncr.rootCause ?? "Pending analysis"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="hidden md:block text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Severity</p>
                      <p className={`text-xs font-bold ${ncr.severity === "Critical" ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>
                        {ncr.severity}
                      </p>
                    </div>
                    <div className="hidden md:block text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        {ncr.status === "Closed" ? "Closed" : "Timestamp"}
                      </p>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{ncr.closureDate ?? ncr.createdAt}</p>
                    </div>
                    <button className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </motion.div>
              ))}
              {filteredNCRs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center dark:border-white/10">
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-300">No NCRs match these filters</p>
                  <p className="mt-1 text-xs text-gray-400">Try another severity, status, or search term.</p>
                </div>
              )}
            </div>

            <button className="w-full mt-6 py-4 border border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-xs font-bold text-gray-400 hover:text-black dark:hover:text-white transition-all">
              View All Quality Records
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight mb-6">Pending Inspections</h3>
            <div className="space-y-6">
              {[
                { label: "Incoming Materials", count: 8, icon: <FileText className="text-blue-500" /> },
                { label: "In-Process Audit", count: 3, icon: <Activity className="text-teal-500" /> },
                { label: "Final Release", count: 5, icon: <CheckCircle2 className="text-green-500" /> },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      {item.icon}
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded-lg text-xs font-bold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black dark:bg-white p-8 rounded-[2.5rem] text-white dark:text-black overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-lg font-bold tracking-tight mb-2">Quality Score</h3>
              <p className="text-4xl font-bold mb-4">9.8</p>
              <p className="text-xs opacity-60 font-light leading-relaxed">
                Your plant is currently operating at 98% efficiency. 0 critical defects detected in the last 7 days.
              </p>
            </div>
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-white/10 dark:bg-black/5 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
