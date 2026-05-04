"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  Search, 
  Plus, 
  FileText, 
  FileSpreadsheet, 
  FileIcon,
  Folder,
  Download,
  Share2,
  MoreVertical,
  X,
  UploadCloud
} from "lucide-react";
import Link from "next/link";

type FileType = "excel" | "word" | "powerpoint" | "pdf" | "folder";

interface Document {
  id: string;
  name: string;
  type: FileType;
  size: string;
  modifiedAt: string;
  author: string;
}

const initialFiles: Document[] = [
  { id: "d1", name: "Q2_Financial_Report.xlsx", type: "excel", size: "1.2 MB", modifiedAt: "2 hours ago", author: "Admin" },
  { id: "d2", name: "NPI_Process_Guideline.docx", type: "word", size: "845 KB", modifiedAt: "1 day ago", author: "Sarah Connor" },
  { id: "d3", name: "All-Hands_Q2_Deck.pptx", type: "powerpoint", size: "4.5 MB", modifiedAt: "3 days ago", author: "Admin" },
  { id: "d4", name: "Vendor_Contracts", type: "folder", size: "--", modifiedAt: "1 week ago", author: "System" },
  { id: "d5", name: "ISO9001_Audit_Results.pdf", type: "pdf", size: "2.1 MB", modifiedAt: "1 week ago", author: "John Smith" },
];

export default function DocumentsPage() {
  const [files, setFiles] = useState<Document[]>(initialFiles);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<Document | null>(null);

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    const newFile: Document = {
      id: Math.random().toString(),
      name: `New_Upload_${Math.floor(Math.random() * 100)}.xlsx`,
      type: "excel",
      size: "450 KB",
      modifiedAt: "Just now",
      author: "Admin (You)"
    };
    setFiles([newFile, ...files]);
    setIsUploadModalOpen(false);
  };

  const getFileIcon = (type: FileType) => {
    switch(type) {
      case "excel": return <FileSpreadsheet className="w-8 h-8 text-green-600" />;
      case "word": return <FileText className="w-8 h-8 text-blue-600" />;
      case "powerpoint": return <FileIcon className="w-8 h-8 text-orange-600" />; // using generic file icon for PPT
      case "pdf": return <FileText className="w-8 h-8 text-red-600" />;
      case "folder": return <Folder className="w-8 h-8 text-yellow-500 fill-yellow-500/20" />;
      default: return <FileText className="w-8 h-8 text-gray-500" />;
    }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">Workspace Documents</h1>
            <p className="text-gray-500 dark:text-gray-400 font-light">Cloud Storage & Office Suite Integration</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 dark:shadow-white/5 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New / Upload
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-[#111] p-4 rounded-[2rem] border border-gray-100 dark:border-white/5 mb-8 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search Excel, Word, PowerPoint, or PDFs..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-black/5 transition-all"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400 text-xs uppercase tracking-widest font-semibold border-b border-gray-100 dark:border-white/5">
                <th className="px-6 py-5 font-medium">Name</th>
                <th className="px-6 py-5 font-medium">Author</th>
                <th className="px-6 py-5 font-medium">Last Modified</th>
                <th className="px-6 py-5 font-medium">Size</th>
                <th className="px-6 py-5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              <AnimatePresence>
                {filteredFiles.map((file, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.05 }}
                    key={file.id}
                    onClick={() => file.type !== 'folder' && setSelectedFile(file)}
                    className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {getFileIcon(file.type)}
                        <span className="font-semibold text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center text-[10px] font-bold">
                          {file.author.charAt(0)}
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{file.author}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{file.modifiedAt}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{file.size}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-white dark:hover:bg-[#222] rounded-lg shadow-sm border border-gray-200 dark:border-white/10 transition-all text-gray-500"><Download className="w-4 h-4" /></button>
                        <button className="p-2 hover:bg-white dark:hover:bg-[#222] rounded-lg shadow-sm border border-gray-200 dark:border-white/10 transition-all text-gray-500"><Share2 className="w-4 h-4" /></button>
                        <button className="p-2 hover:bg-white dark:hover:bg-[#222] rounded-lg shadow-sm border border-gray-200 dark:border-white/10 transition-all text-gray-500"><MoreVertical className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#111] rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-white/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2"><UploadCloud className="w-6 h-6" /> Upload Document</h2>
                <button onClick={() => setIsUploadModalOpen(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[2rem] p-12 text-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group mb-6">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="font-bold mb-1">Drag & drop your files here</h3>
                <p className="text-xs text-gray-500">Supports .xlsx, .docx, .pptx, .pdf up to 50MB</p>
              </div>
              
              <button onClick={handleUpload} className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all">
                Browse Files
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* File Preview Modal (Simulated Office Viewer) */}
      <AnimatePresence>
        {selectedFile && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111] rounded-[2rem] w-full h-full max-w-6xl shadow-2xl border border-gray-100 dark:border-white/5 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  {getFileIcon(selectedFile.type)}
                  <div>
                    <h2 className="font-bold">{selectedFile.name}</h2>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Office Suite Viewer • Read Only</p>
                  </div>
                </div>
                <button onClick={() => setSelectedFile(null)} className="p-2 bg-gray-200 dark:bg-white/10 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 bg-gray-100 dark:bg-[#0A0A0A] flex flex-col items-center justify-center text-center p-10">
                <div className="w-32 h-32 mb-6 opacity-50 animate-pulse">
                  {getFileIcon(selectedFile.type)}
                </div>
                <h3 className="text-2xl font-bold mb-2">Simulated Office Document</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  In a full production environment, this would render an iframe of Microsoft Office Online or an embedded canvas rendering the `{selectedFile.type}` file natively.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
