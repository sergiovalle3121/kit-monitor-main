"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Filter, 
  Plus, 
  Package, 
  ChevronLeft,
  Download,
  History,
  X,
  FileSpreadsheet,
  FileText,
  Boxes,
  ArrowRightLeft,
  Barcode,
  MoreVertical,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---
type InventoryItemStatus = "In Stock" | "Reorder" | "Critical";
type InventoryCategory = "Consumables" | "Electronics" | "Fasteners" | "Mechanical" | "Raw Materials";

interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  stock: number;
  allocated: number;
  inTransit: number;
  reorderPoint: number;
  maxStock: number;
  unit: string;
  status: InventoryItemStatus;
  price: number;
  warehouseId: string;
  location: string;
  lastUpdated?: string;
}

// --- Styles ---
const statusStyles: Record<InventoryItemStatus, string> = {
    "In Stock": "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    "Reorder": "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
    "Critical": "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20",
};

export default function EnterpriseInventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<"master" | "movements">("master");

  // Fetch logic prepared for Claude's backend
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory");
      if (res.ok) {
        const data = await res.json();
        setInventory(data);
      } else {
        // Fallback mock if API not ready yet
        simulateDataLoad();
      }
    } catch (e) {
      simulateDataLoad(); // Fallback
    }
  };

  const simulateDataLoad = () => {
    setTimeout(() => {
      setInventory([
        { id: "SKU-1024", name: "Steel Plate 4x8", category: "Raw Materials", stock: 142, allocated: 18, inTransit: 40, reorderPoint: 35, maxStock: 220, unit: "pcs", status: "In Stock", price: 45.00, warehouseId: "WH-A1", location: "BULK-A03", lastUpdated: "2026-05-04T10:00:00Z" },
        { id: "SKU-2055", name: "Aluminum Extrusion", category: "Raw Materials", stock: 12, allocated: 6, inTransit: 30, reorderPoint: 40, maxStock: 160, unit: "m", status: "Critical", price: 82.50, warehouseId: "WH-A1", location: "RACK-12", lastUpdated: "2026-05-04T09:15:00Z" },
        { id: "SKU-3091", name: "M6 Hex Bolt", category: "Fasteners", stock: 4500, allocated: 650, inTransit: 1200, reorderPoint: 900, maxStock: 6000, unit: "pcs", status: "In Stock", price: 0.12, warehouseId: "WH-B2", location: "BIN-F06", lastUpdated: "2026-05-03T16:20:00Z" },
        { id: "SKU-4022", name: "Controller v2", category: "Electronics", stock: 24, allocated: 8, inTransit: 16, reorderPoint: 30, maxStock: 90, unit: "pcs", status: "Reorder", price: 120.00, warehouseId: "WH-QA", location: "ESD-02", lastUpdated: "2026-05-02T11:45:00Z" },
      ]);
      setLoading(false);
    }, 800);
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredInventory = inventory.filter(i => 
    i.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(inventory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory_Master");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]), "SAP_Inventory_Export.xlsx");
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] dark:bg-[#0A0A0A] text-[#1D1D1F] dark:text-[#F5F5F7] font-sans flex overflow-hidden">
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${selectedItem ? 'pr-96' : ''}`}>
        
        {/* Top Header */}
        <header className="px-8 py-6 bg-white dark:bg-[#111] border-b border-[#E5E5EA] dark:border-white/5 flex justify-between items-center z-10">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Boxes className="w-6 h-6 text-blue-600" /> Material Master Data
              </h1>
              <div className="flex gap-4 mt-1 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                <span>Total Items: {inventory.length}</span>
                <span>Value: ${inventory.reduce((acc, curr) => acc + (curr.stock * curr.price), 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={fetchInventory} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={exportExcel} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            <button className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg text-sm font-semibold hover:scale-105 transition-transform ml-2">
              <Plus className="w-4 h-4" /> Create Material
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <div className="px-8 py-4 flex gap-4 bg-[#FBFBFD] dark:bg-[#0A0A0A] border-b border-[#E5E5EA] dark:border-white/5 items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search SKU or description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
            <Filter className="w-4 h-4" /> Advanced Filter
          </button>
          
          <div className="ml-auto flex bg-gray-200/50 dark:bg-white/5 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab("master")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'master' ? 'bg-white dark:bg-[#222] shadow-sm' : 'text-gray-500'}`}
            >
              Master Data
            </button>
            <button 
              onClick={() => setActiveTab("movements")}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${activeTab === 'movements' ? 'bg-white dark:bg-[#222] shadow-sm' : 'text-gray-500'}`}
            >
              Movements
            </button>
          </div>
        </div>

        {/* Dense Data Grid */}
        <div className="flex-1 overflow-auto bg-white dark:bg-[#111]">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-400 flex-col gap-4">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <p className="text-sm">Synchronizing with SAP/Backend...</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 bg-[#F5F5F7] dark:bg-[#1A1A1C] z-10 shadow-sm">
                <tr className="text-gray-500 dark:text-gray-400 text-[10px] uppercase tracking-wider font-bold">
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-white/5">Material ID</th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-white/5">Description</th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-white/5">Stock Level</th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-white/5">Status</th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-white/5">Location</th>
                  <th className="px-6 py-3 border-b border-gray-200 dark:border-white/5 text-right">Unit Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredInventory.map(item => (
                  <tr 
                    key={item.id} 
                    onClick={() => setSelectedItem(item)}
                    className={`cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-500/10 ${selectedItem?.id === item.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                  >
                    <td className="px-6 py-3 font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                      {item.id}
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">{item.name}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{item.category}</div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1 w-32">
                        <div className="flex justify-between text-xs font-bold">
                          <span>{item.stock} {item.unit}</span>
                          <span className="text-gray-400 font-normal">{item.maxStock}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${item.stock <= item.reorderPoint ? 'bg-red-500' : 'bg-green-500'}`} 
                            style={{ width: `${Math.min((item.stock / item.maxStock) * 100, 100)}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${statusStyles[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-gray-600 dark:text-gray-300">
                      {item.warehouseId} <br/> <span className="text-gray-400 font-mono">{item.location}</span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs">
                      ${item.price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Enterprise Side Panel (Slide Over) */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div 
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-96 h-screen bg-white dark:bg-[#1C1C1E] shadow-2xl border-l border-gray-200 dark:border-white/10 z-50 flex flex-col"
          >
            {/* Panel Header */}
            <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-500/20 text-blue-600 rounded-xl">
                  <Package className="w-6 h-6" />
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-2 bg-gray-200 dark:bg-white/10 rounded-full hover:bg-gray-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-1">{selectedItem.name}</h2>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-gray-500 bg-gray-200 dark:bg-white/10 px-2 py-0.5 rounded">{selectedItem.id}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusStyles[selectedItem.status]}`}>
                  {selectedItem.status}
                </span>
              </div>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Available</p>
                  <p className="text-2xl font-bold text-green-600">{selectedItem.stock} <span className="text-sm font-normal text-gray-400">{selectedItem.unit}</span></p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Allocated</p>
                  <p className="text-2xl font-bold text-amber-600">{selectedItem.allocated} <span className="text-sm font-normal text-gray-400">{selectedItem.unit}</span></p>
                </div>
              </div>

              {/* Replenishment Data */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 dark:border-white/10 pb-2">MRP Parameters</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Reorder Point</span>
                    <span className="font-bold">{selectedItem.reorderPoint} {selectedItem.unit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Maximum Stock</span>
                    <span className="font-bold">{selectedItem.maxStock} {selectedItem.unit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">In Transit (PO)</span>
                    <span className="font-bold text-blue-500">+{selectedItem.inTransit} {selectedItem.unit}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Unit Cost (Standard)</span>
                    <span className="font-mono font-bold">${selectedItem.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Barcode / Storage */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-100 dark:border-white/10 pb-2">Storage & Tracking</h3>
                <div className="bg-gray-100 dark:bg-white/10 p-4 rounded-xl flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-bold">Warehouse: {selectedItem.warehouseId}</p>
                    <p className="text-[10px] font-mono text-gray-500">{selectedItem.location}</p>
                  </div>
                  <Barcode className="w-12 h-12 text-black dark:text-white opacity-50" />
                </div>
              </div>

            </div>

            {/* Panel Footer Actions */}
            <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#111] grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-[#222] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-colors">
                <ArrowRightLeft className="w-4 h-4" /> Transfer
              </button>
              <button className="flex items-center justify-center gap-2 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold shadow-md hover:scale-[1.02] transition-transform">
                <Package className="w-4 h-4" /> Adjust Stock
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
