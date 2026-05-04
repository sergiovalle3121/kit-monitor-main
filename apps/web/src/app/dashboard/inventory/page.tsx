"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { 
  Search, 
  Filter, 
  Plus, 
  ArrowUpDown, 
  Package, 
  AlertTriangle, 
  ChevronLeft,
  Download,
  Edit2,
  Trash2,
  History,
  X,
  Save,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import Link from "next/link";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type InventoryItemStatus = "In Stock" | "Reorder" | "Critical";

type InventoryCategory =
  | "Consumables"
  | "Electronics"
  | "Fasteners"
  | "Mechanical"
  | "Raw Materials";

type InventoryCategoryFilter = InventoryCategory | "all";

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
}

const statusStyles: Record<InventoryItemStatus, string> = {
    "In Stock": "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 border-green-100 dark:border-green-500/20",
    "Reorder": "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400 border-yellow-100 dark:border-yellow-500/20",
    "Critical": "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border-red-100 dark:border-red-500/20",
};

// UI projection of MaterialMaster + InventoryPosition + ReplenishmentRule.
const mockInventory: InventoryItem[] = [
  { id: "SKU-1024", name: "Steel Plate 4x8", category: "Raw Materials", stock: 142, allocated: 18, inTransit: 40, reorderPoint: 35, maxStock: 220, unit: "pcs", status: "In Stock", price: 45.00, warehouseId: "WH-A1", location: "BULK-A03" },
  { id: "SKU-2055", name: "Aluminum Extrusion", category: "Raw Materials", stock: 12, allocated: 6, inTransit: 30, reorderPoint: 40, maxStock: 160, unit: "m", status: "Critical", price: 82.50, warehouseId: "WH-A1", location: "RACK-12" },
  { id: "SKU-3091", name: "M6 Hex Bolt", category: "Fasteners", stock: 4500, allocated: 650, inTransit: 1200, reorderPoint: 900, maxStock: 6000, unit: "pcs", status: "In Stock", price: 0.12, warehouseId: "WH-B2", location: "BIN-F06" },
  { id: "SKU-4022", name: "Electronic Controller v2", category: "Electronics", stock: 24, allocated: 8, inTransit: 16, reorderPoint: 30, maxStock: 90, unit: "pcs", status: "Reorder", price: 120.00, warehouseId: "WH-QA", location: "ESD-02" },
  { id: "SKU-5011", name: "Hydraulic Pump", category: "Mechanical", stock: 5, allocated: 2, inTransit: 0, reorderPoint: 10, maxStock: 35, unit: "pcs", status: "Critical", price: 450.00, warehouseId: "WH-A1", location: "CAGE-01" },
  { id: "SKU-6033", name: "Thermal Paste", category: "Consumables", stock: 85, allocated: 12, inTransit: 24, reorderPoint: 25, maxStock: 140, unit: "tubes", status: "In Stock", price: 15.00, warehouseId: "WH-B2", location: "CHEM-04" },
];

const isLowStock = (item: InventoryItem) => item.stock <= item.reorderPoint;

const StatusBadge = ({ status }: { status: InventoryItemStatus }) => {
  const styles = statusStyles[status];

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles}`}>
      {status}
    </span>
  );
};

export default function InventoryExplorerPage() {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>(mockInventory);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<InventoryCategoryFilter>("all");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem?.id) {
      const isExisting = inventoryData.some(item => item.id === editingItem.id);
      if (isExisting) {
        setInventoryData(inventoryData.map(item => item.id === editingItem.id ? editingItem as InventoryItem : item));
      } else {
        setInventoryData([...inventoryData, { ...editingItem, status: "In Stock" } as InventoryItem]);
      }
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    setInventoryData(inventoryData.filter(item => item.id !== id));
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredInventory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(data, "Inventory_Report.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Inventory Report", 14, 15);
    autoTable(doc, {
      head: [['SKU', 'Name', 'Category', 'Stock', 'Status']],
      body: filteredInventory.map(item => [item.id, item.name, item.category, item.stock.toString(), item.status]),
      startY: 20,
    });
    doc.save("Inventory_Report.pdf");
  };

  const deferredSearchTerm = useDeferredValue(searchTerm);

  const categories = useMemo(
    () => Array.from(new Set(inventoryData.map((item) => item.category))).sort(),
    [inventoryData]
  );

  const filteredInventory = useMemo(() => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();

    return inventoryData.filter((item) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch);
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchesLowStock = !showLowStockOnly || isLowStock(item);

      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [deferredSearchTerm, selectedCategory, showLowStockOnly]);

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
          <button onClick={exportToExcel} className="px-4 py-3 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-medium hover:bg-white dark:hover:bg-white/5 transition-all flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            Excel
          </button>
          <button onClick={exportToPDF} className="px-4 py-3 border border-gray-200 dark:border-white/10 rounded-2xl text-sm font-medium hover:bg-white dark:hover:bg-white/5 transition-all flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-500" />
            PDF
          </button>
          <button 
            onClick={() => {
              setEditingItem({ id: `SKU-${Math.floor(Math.random() * 9000) + 1000}`, stock: 0, reorderPoint: 10, maxStock: 100, category: "Consumables", unit: "pcs" });
              setIsModalOpen(true);
            }}
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
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
            placeholder="Search by name or category..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as InventoryCategoryFilter)}
              className="w-full appearance-none bg-gray-50 dark:bg-white/5 rounded-xl py-3 pl-10 pr-8 text-sm font-medium outline-none hover:bg-gray-100 dark:hover:bg-white/10 focus:ring-2 focus:ring-black/5 transition-all"
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setShowLowStockOnly((current) => !current)}
            aria-pressed={showLowStockOnly}
            className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
              showLowStockOnly
                ? "bg-red-50 text-red-600 shadow-sm shadow-red-500/10 dark:bg-red-500/10 dark:text-red-400"
                : "bg-gray-50 text-red-500 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10"
            }`}
          >
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
                <th className="px-8 py-6">
                  <div className="flex items-center gap-2">
                    Stock Level
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-8 py-6 text-center">Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-white/5">
              {filteredInventory.map((item) => (
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
                          style={{ width: `${Math.min(100, (item.stock / item.maxStock) * 100)}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-medium text-gray-400">
                        Min {item.reorderPoint} {item.unit}
                      </span>
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
                      <button 
                        onClick={() => {
                          setEditingItem(item);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-14 text-center">
                    <p className="text-sm font-bold text-gray-500 dark:text-gray-300">No materials found</p>
                    <p className="mt-1 text-xs text-gray-400">Try another name, category, or stock filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="px-8 py-6 bg-gray-50/50 dark:bg-white/[0.02] border-t border-gray-50 dark:border-white/5 flex justify-between items-center">
          <p className="text-xs text-gray-400 font-medium">
            Showing {filteredInventory.length} of {inventoryData.length} materials
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold disabled:opacity-30" disabled>Previous</button>
            <button className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold">Next</button>
          </div>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#111] rounded-[2rem] p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-white/5"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{editingItem.name ? 'Edit Material' : 'New Material'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Material Name</label>
                <input 
                  type="text" required 
                  value={editingItem.name || ''} 
                  onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">SKU</label>
                  <input 
                    type="text" required 
                    value={editingItem.id || ''} 
                    onChange={e => setEditingItem({...editingItem, id: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Category</label>
                  <select 
                    value={editingItem.category || ''} 
                    onChange={e => setEditingItem({...editingItem, category: e.target.value as InventoryCategory})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                  >
                    <option value="Raw Materials">Raw Materials</option>
                    <option value="Fasteners">Fasteners</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Consumables">Consumables</option>
                    <option value="Mechanical">Mechanical</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Current Stock</label>
                  <input 
                    type="number" required 
                    value={editingItem.stock || 0} 
                    onChange={e => setEditingItem({...editingItem, stock: parseInt(e.target.value)})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Min Stock</label>
                  <input 
                    type="number" required 
                    value={editingItem.reorderPoint || 0} 
                    onChange={e => setEditingItem({...editingItem, reorderPoint: parseInt(e.target.value)})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Unit</label>
                  <input 
                    type="text" required 
                    value={editingItem.unit || ''} 
                    onChange={e => setEditingItem({...editingItem, unit: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>
              </div>
              
              <button type="submit" className="w-full py-4 mt-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all">
                <Save className="w-4 h-4" /> Save Material
              </button>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
