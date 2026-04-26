"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  ArrowUpDown, 
  Package, 
  AlertTriangle, 
  CheckCircle2,
  ChevronLeft,
  Download,
  Edit2,
  Trash2,
  History
} from "lucide-react";
import Link from "next/link";

// Mock Data - To be replaced by Codex/API later
const mockInventory = [
  { id: "SKU-1024", name: "Steel Plate 4x8", category: "Raw Materials", stock: 142, unit: "pcs", status: "In Stock", price: 45.00 },
  { id: "SKU-2055", name: "Aluminum Extrusion", category: "Raw Materials", stock: 12, unit: "m", status: "Critical", price: 82.50 },
  { id: "SKU-3091", name: "M6 Hex Bolt", category: "Fasteners", stock: 4500, unit: "pcs", status: "In Stock", price: 0.12 },
  { id: "SKU-4022", name: "Electronic Controller v2", category: "Electronics", stock: 24, unit: "pcs", status: "Reorder", price: 120.00 },
  { id: "SKU-5011", name: "Hydraulic Pump", category: "Mechanical", stock: 5, unit: "pcs", status: "Critical", price: 450.00 },
  { id: "SKU-6033", name: "Thermal Paste", category: "Consumables", stock: 85, unit: "tubes", status: "In Stock", price: 15.00 },
];

const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    "In Stock": "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border-green-100 dark:border-green-500/20",
    "Reorder": "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-100 dark:border-yellow-500/20",
    "Critical": "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20",
  }[status] || "bg-gray-50 text-gray-600 dark:bg-white/5 dark:text-gray-400 border-gray-100 dark:border-white/10";

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
      {status}
    </span>
  );
};

export default function InventoryExplorerPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Inventory Explorer</h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">Global material management and stock control</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-medium hover:bg-white dark:hover:bg-white/5 transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Material
          </button>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-[#111] p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by SKU or Name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="px-4 py-3 bg-gray-50 dark:bg-white/5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-all">
            <Filter className="w-4 h-4" />
            All Categories
          </button>
          <button className="px-4 py-3 bg-gray-50 dark:bg-white/5 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-red-500">
            <AlertTriangle className="w-4 h-4" />
            Low Stock
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50 dark:border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <th className="px-8 py-6">Material</th>
                <th className="px-8 py-6">SKU</th>
                <th className="px-8 py-6">Category</th>
                <th className="px-8 py-6">Stock Level</th>
                <th className="px-8 py-6 text-center">Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {mockInventory.map((item) => (
                <motion.tr 
                  key={item.id}
                  whileHover={{ backgroundColor: "rgba(0,0,0,0.01)" }}
                  className="group transition-colors"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-xl flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-sm font-bold">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-gray-500">{item.id}</td>
                  <td className="px-8 py-5">
                    <span className="text-xs px-2 py-1 bg-gray-50 dark:bg-white/5 rounded-lg text-gray-500">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold">{item.stock} <span className="font-light text-gray-400">{item.unit}</span></span>
                      <div className="w-24 h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${item.status === 'Critical' ? 'bg-red-500' : item.status === 'Reorder' ? 'bg-yellow-500' : 'bg-green-500'}`} 
                          style={{ width: `${Math.min(100, (item.stock / 200) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                        <History className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="px-8 py-6 bg-gray-50/50 dark:bg-white/[0.02] border-t border-gray-50 dark:border-white/5 flex justify-between items-center">
          <p className="text-xs text-gray-400 font-medium">Showing 6 of 1,240 materials</p>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold disabled:opacity-30" disabled>Previous</button>
            <button className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold">Next</button>
          </div>
        </div>
      </div>

    </div>
  );
}
