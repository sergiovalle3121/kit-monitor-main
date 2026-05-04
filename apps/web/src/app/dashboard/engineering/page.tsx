"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  Plus, 
  Search, 
  Filter, 
  Layers, 
  FileText, 
  CheckCircle,
  GitBranch,
  Edit2,
  Trash2,
  Cpu
} from "lucide-react";
import Link from "next/link";

type NpiStatus = "Draft" | "Review" | "Approved" | "In Production";

interface ProductNPI {
  id: string;
  name: string;
  description: string;
  version: string;
  status: NpiStatus;
  bomCount: number;
}

const mockNPIs: ProductNPI[] = [
  { id: "PRD-9921", name: "Controller V3", description: "Next gen logic board", version: "1.0", status: "Review", bomCount: 45 },
  { id: "PRD-8840", name: "Thermal Sensor Grid", description: "High-precision temp grid", version: "2.1", status: "In Production", bomCount: 12 },
  { id: "PRD-7732", name: "Robotic Arm Actuator", description: "Servo motor assembly", version: "1.0", status: "Draft", bomCount: 0 },
];

export default function EngineeringNPIPage() {
  const [npiList, setNpiList] = useState<ProductNPI[]>(mockNPIs);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNpi, setEditingNpi] = useState<Partial<ProductNPI> | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingNpi?.id) {
      const isExisting = npiList.some(item => item.id === editingNpi.id);
      if (isExisting) {
        setNpiList(npiList.map(item => item.id === editingNpi.id ? editingNpi as ProductNPI : item));
      } else {
        setNpiList([...npiList, { ...editingNpi, status: "Draft", bomCount: 0 } as ProductNPI]);
      }
    }
    setIsModalOpen(false);
    setEditingNpi(null);
  };

  const filteredNPIs = npiList.filter(npi => 
    npi.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    npi.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Engineering & NPI</h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">New Product Introduction & BOM Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setEditingNpi({ id: `PRD-${Math.floor(Math.random() * 9000) + 1000}`, name: "", version: "1.0" });
              setIsModalOpen(true);
            }}
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create NPI / Product
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-[#111] p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search products by name or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
        <button className="px-4 py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNPIs.map((npi, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={npi.id} 
            className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                <Cpu className="w-6 h-6 text-indigo-500" />
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                npi.status === 'Approved' ? 'bg-green-50 text-green-600 border-green-100' :
                npi.status === 'In Production' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                npi.status === 'Review' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400'
              }`}>
                {npi.status}
              </span>
            </div>
            
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-1">{npi.name} <span className="text-sm font-light text-gray-400 ml-2">v{npi.version}</span></h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{npi.description}</p>
              <p className="text-xs font-medium text-gray-400 mt-2">ID: {npi.id}</p>
            </div>

            <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold">{npi.bomCount}</p>
                <p className="text-[10px] uppercase text-gray-400 tracking-wider">BOM Items</p>
              </div>
              <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
              <div className="flex-1 text-center flex flex-col items-center">
                <GitBranch className="w-5 h-5 mb-1 text-gray-500" />
                <p className="text-[10px] uppercase text-gray-400 tracking-wider">Revisions</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setEditingNpi(npi);
                  setIsModalOpen(true);
                }}
                className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-2"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
              <button className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-2">
                <Layers className="w-3 h-3" /> Open BOM
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && editingNpi && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111] rounded-[2rem] p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-white/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{editingNpi.name ? 'Edit Product/NPI' : 'New Product/NPI'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10">
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Product Name</label>
                  <input 
                    type="text" required 
                    value={editingNpi.name || ''} 
                    onChange={e => setEditingNpi({...editingNpi, name: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Description</label>
                  <textarea 
                    rows={3}
                    value={editingNpi.description || ''} 
                    onChange={e => setEditingNpi({...editingNpi, description: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all resize-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Product ID</label>
                    <input 
                      type="text" required disabled
                      value={editingNpi.id || ''} 
                      className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none opacity-50 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Version</label>
                    <input 
                      type="text" required 
                      value={editingNpi.version || ''} 
                      onChange={e => setEditingNpi({...editingNpi, version: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  </div>
                </div>

                {editingNpi.name && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Status</label>
                    <select 
                      value={editingNpi.status || 'Draft'} 
                      onChange={e => setEditingNpi({...editingNpi, status: e.target.value as NpiStatus})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Review">Review</option>
                      <option value="Approved">Approved</option>
                      <option value="In Production">In Production</option>
                    </select>
                  </div>
                )}
                
                <button type="submit" className="w-full py-4 mt-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  <CheckCircle className="w-4 h-4" /> {editingNpi.name ? 'Save Changes' : 'Create Product'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
