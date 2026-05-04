"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  ShieldAlert, 
  CheckCircle,
  Plus,
  Search,
  Filter,
  Camera,
  MessageSquare
} from "lucide-react";
import Link from "next/link";

type Severity = "Critical" | "Major" | "Minor";
type Status = "Open" | "In Review" | "Resolved";

interface QualityTicket {
  id: string;
  title: string;
  product: string;
  severity: Severity;
  status: Status;
  reportedBy: string;
  date: string;
  comments: number;
}

const initialTickets: QualityTicket[] = [
  { id: "NCR-2041", title: "Dimensional variance on casing", product: "Controller V3", severity: "Major", status: "Open", reportedBy: "J. Smith", date: "2026-05-04", comments: 3 },
  { id: "NCR-2040", title: "Thermal paste missing", product: "Thermal Sensor Grid", severity: "Critical", status: "In Review", reportedBy: "M. Chen", date: "2026-05-03", comments: 5 },
  { id: "NCR-2039", title: "Scratched surface", product: "Robotic Arm Actuator", severity: "Minor", status: "Resolved", reportedBy: "L. Davis", date: "2026-05-01", comments: 1 },
  { id: "NCR-2042", title: "Failed voltage test", product: "Power Supply Unit", severity: "Critical", status: "Open", reportedBy: "A. Wilson", date: "2026-05-04", comments: 0 },
];

export default function QualityPage() {
  const [tickets, setTickets] = useState<QualityTicket[]>(initialTickets);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTickets = tickets.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.product.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: { title: string; status: Status }[] = [
    { title: "Reported (Open)", status: "Open" },
    { title: "Under Investigation", status: "In Review" },
    { title: "Resolved / Closed", status: "Resolved" }
  ];

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("ticketId", id);
  };

  const handleDrop = (e: React.DragEvent, status: Status) => {
    const ticketId = e.dataTransfer.getData("ticketId");
    setTickets(tickets.map(t => t.id === ticketId ? { ...t, status } : t));
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Quality Control</h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">Non-Conformance Reports (NCR) & Audits</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3 bg-red-600 text-white rounded-2xl text-sm font-bold shadow-xl shadow-red-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Report Defect
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-[#111] p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 mb-8 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search NCRs by ID, title or product..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
        <button className="px-4 py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl text-sm font-medium flex items-center gap-2 transition-all">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {columns.map(col => (
          <div 
            key={col.status}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, col.status)}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-500 dark:text-gray-400">{col.title}</h2>
              <span className="px-2.5 py-0.5 bg-gray-200 dark:bg-white/10 rounded-full text-xs font-bold">
                {filteredTickets.filter(t => t.status === col.status).length}
              </span>
            </div>

            <AnimatePresence>
              {filteredTickets.filter(t => t.status === col.status).map(ticket => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={ticket.id}
                  draggable
                  onDragStart={(e: any) => handleDragStart(e, ticket.id)}
                  className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-[1.5rem] p-5 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-xl transition-all border-l-4"
                  style={{ borderLeftColor: ticket.severity === 'Critical' ? '#ef4444' : ticket.severity === 'Major' ? '#f59e0b' : '#3b82f6' }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold text-gray-400">{ticket.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold uppercase ${
                      ticket.severity === 'Critical' ? 'bg-red-50 text-red-600' :
                      ticket.severity === 'Major' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {ticket.severity}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-sm mb-1">{ticket.title}</h3>
                  <p className="text-xs text-gray-500 mb-4">{ticket.product}</p>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-black dark:bg-white flex justify-center items-center text-white dark:text-black text-[10px] font-bold">
                        {ticket.reportedBy.charAt(0)}
                      </div>
                      <span className="text-[10px] text-gray-400">{ticket.date}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <button className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1 text-xs">
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      <button className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1 text-xs">
                        <MessageSquare className="w-3.5 h-3.5" /> {ticket.comments}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
