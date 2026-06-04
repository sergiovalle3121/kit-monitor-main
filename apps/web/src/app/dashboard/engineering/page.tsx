"use client";

import React, { useState, useEffect } from "react";
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
  Cpu,
  Loader2,
  X,
  Lock,
  Unlock,
  AlertTriangle,
  DollarSign,
  Barcode,
  Check,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

type NpiStatus = "Draft" | "Review" | "Approved" | "In Production";

interface ProductNPI {
  id: string; // Model ID
  name: string;
  description: string;
  version: string;
  status: NpiStatus;
  bomCount: number;
}

const mockNPIs: ProductNPI[] = [
  { id: "PRD-9921", name: "Controller V3", description: "Next gen logic board", version: "1.0", status: "Review", bomCount: 4 },
  { id: "PRD-8840", name: "Thermal Sensor Grid", description: "High-precision temp grid", version: "2.1", status: "In Production", bomCount: 6 },
  { id: "PRD-7732", name: "Robotic Arm Actuator", description: "Servo motor assembly", version: "1.0", status: "Draft", bomCount: 0 },
];

export default function EngineeringNPIPage() {
  const [npiList, setNpiList] = useState<ProductNPI[]>(mockNPIs);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNpi, setEditingNpi] = useState<Partial<ProductNPI> | null>(null);

  // --- BOM States ---
  const [activeBomProduct, setActiveBomProduct] = useState<ProductNPI | null>(null);
  const [bomHeader, setBomHeader] = useState<any | null>(null);
  const [bomComponents, setBomComponents] = useState<any[]>([]);
  const [loadingBom, setLoadingBom] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [showCreateBomModal, setShowCreateBomModal] = useState(false);
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<any | null>(null);

  // --- Form States ---
  const [bomForm, setBomForm] = useState({
    bomType: "Manufacturing",
    baseQuantity: 1,
    baseUnit: "EA",
    description: "",
    revision: "1.0"
  });

  const [compForm, setCompForm] = useState({
    componentNumber: "",
    quantity: 1,
    unit: "EA",
    usageFactor: 1,
    level: 1,
    referenceDesignator: "",
    notes: "",
    isPhantom: false
  });

  const [skuSearch, setSkuSearch] = useState("");
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);
  const [localFallbackMode, setLocalFallbackMode] = useState(false);

  // Load catalog for SKU autocomplete
  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch("/api/inventory/positions");
        if (res.ok) {
          const data = await res.json();
          // Extract material details
          const uniqueMaterials = data.map((pos: any) => pos.material).filter(Boolean);
          // Deduplicate
          const seen = new Set();
          const cleanCatalog = uniqueMaterials.filter((m: any) => {
            if (seen.has(m.partNumber)) return false;
            seen.add(m.partNumber);
            return true;
          });
          setCatalog(cleanCatalog);
        } else {
          loadMockCatalog();
        }
      } catch {
        loadMockCatalog();
      }
    }
    
    function loadMockCatalog() {
      setCatalog([
        { partNumber: "SKU-1024", description: "Steel Plate 4x8", uom: "pcs", standardCost: 45.00, category: "Raw Materials" },
        { partNumber: "SKU-2055", description: "Aluminum Extrusion", uom: "m", standardCost: 82.50, category: "Raw Materials" },
        { partNumber: "SKU-3091", description: "M6 Hex Bolt", uom: "pcs", standardCost: 0.12, category: "Fasteners" },
        { partNumber: "SKU-4022", description: "Controller v2", uom: "pcs", standardCost: 120.00, category: "Electronics" },
        { partNumber: "SKU-5011", description: "Microprocessor Core", uom: "pcs", standardCost: 35.00, category: "Electronics" },
        { partNumber: "SKU-6022", description: "FR4 PCB Blank", uom: "pcs", standardCost: 8.50, category: "Electronics" },
      ]);
    }

    loadCatalog();
  }, []);

  // Fetch BOM when active product changes
  useEffect(() => {
    if (activeBomProduct) {
      fetchBomForProduct(activeBomProduct.id);
    } else {
      setBomHeader(null);
      setBomComponents([]);
    }
  }, [activeBomProduct]);

  const fetchBomForProduct = async (modelId: string) => {
    setLoadingBom(true);
    setLocalFallbackMode(false);
    try {
      const res = await fetch(`/api/bom/headers?model=${modelId}`);
      if (res.ok) {
        const headers = await res.json();
        if (headers && headers.length > 0) {
          // Load the latest revision or active BOM
          const mainHeader = headers[0];
          const treeRes = await fetch(`/api/bom/headers/${mainHeader.id}/tree`);
          if (treeRes.ok) {
            const treeData = await treeRes.json();
            setBomHeader(treeData.header);
            setBomComponents(treeData.components || []);
          } else {
            setBomHeader(mainHeader);
            setBomComponents(mainHeader.components || []);
          }
        } else {
          setBomHeader(null);
          setBomComponents([]);
        }
      } else {
        enableLocalFallback(modelId);
      }
    } catch {
      enableLocalFallback(modelId);
    } finally {
      setLoadingBom(false);
    }
  };

  const enableLocalFallback = (modelId: string) => {
    setLocalFallbackMode(true);
    const key = `local_bom_${modelId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      setBomHeader(parsed.header);
      setBomComponents(parsed.components || []);
    } else {
      setBomHeader(null);
      setBomComponents([]);
    }
  };

  const saveLocalBom = (header: any, components: any[]) => {
    const key = `local_bom_${header.model}`;
    const data = { header, components };
    localStorage.setItem(key, JSON.stringify(data));
    setBomHeader(header);
    setBomComponents(components);
  };

  // --- API Handlers ---

  const handleCreateBom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBomProduct) return;

    const payload = {
      model: activeBomProduct.id,
      productName: activeBomProduct.name,
      revision: bomForm.revision,
      baseQuantity: Number(bomForm.baseQuantity),
      baseUnit: bomForm.baseUnit,
      description: bomForm.description,
      bomType: bomForm.bomType,
      components: []
    };

    if (localFallbackMode) {
      const newHeader = {
        id: Math.floor(Math.random() * 10000) + 1,
        ...payload,
        status: "DRAFT",
        estimatedCost: 0,
        createdBy: "Local User",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      saveLocalBom(newHeader, []);
      setShowCreateBomModal(false);
      return;
    }

    try {
      const res = await fetch("/api/bom/headers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const newHeader = await res.json();
        setBomHeader(newHeader);
        setBomComponents([]);
        setShowCreateBomModal(false);
        // Update parent list bom count
        setNpiList(npiList.map(item => item.id === activeBomProduct.id ? { ...item, bomCount: 1 } : item));
      } else {
        alert("Error al crear el encabezado del BOM en el servidor.");
      }
    } catch {
      alert("Error de conexión al intentar crear el BOM.");
    }
  };

  const handleSaveComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomHeader) return;

    // Validate SKU
    const material = catalog.find(m => m.partNumber === compForm.componentNumber);
    if (!material) {
      alert("Número de parte no válido. Debe existir en el catálogo maestro.");
      return;
    }

    const payload = {
      componentNumber: compForm.componentNumber,
      quantity: Number(compForm.quantity),
      unit: compForm.unit || material.uom || "EA",
      usageFactor: Number(compForm.usageFactor),
      level: Number(compForm.level),
      referenceDesignator: compForm.referenceDesignator,
      notes: compForm.notes,
      isPhantom: compForm.isPhantom,
      description: material.description,
      standardCost: material.standardCost || 0,
      effectiveDate: null,
      expirationDate: null
    };

    const extendedCost = payload.quantity * payload.usageFactor * payload.standardCost;

    if (localFallbackMode) {
      let updatedComponents = [...bomComponents];
      if (editingComponent) {
        updatedComponents = updatedComponents.map(c => c.id === editingComponent.id ? { ...c, ...payload, extendedCost } : c);
      } else {
        updatedComponents.push({
          id: Math.floor(Math.random() * 10000) + 1,
          ...payload,
          extendedCost
        });
      }
      
      const totalCost = updatedComponents.reduce((sum, c) => sum + c.extendedCost, 0);
      const updatedHeader = { ...bomHeader, estimatedCost: totalCost };
      saveLocalBom(updatedHeader, updatedComponents);
      setShowAddComponentModal(false);
      setEditingComponent(null);
      return;
    }

    try {
      let res;
      if (editingComponent) {
        // PATCH
        res = await fetch(`/api/bom/headers/${bomHeader.id}/components/${editingComponent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        // POST
        res = await fetch(`/api/bom/headers/${bomHeader.id}/components`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        await fetchBomForProduct(bomHeader.model);
        setShowAddComponentModal(false);
        setEditingComponent(null);
      } else {
        const err = await res.json();
        alert(err.message || "Error al guardar el componente.");
      }
    } catch {
      alert("Error de red al guardar el componente.");
    }
  };

  const handleRemoveComponent = async (componentId: number) => {
    if (!confirm("¿Estás seguro de eliminar este componente del BOM?")) return;

    if (localFallbackMode) {
      const updatedComponents = bomComponents.filter(c => c.id !== componentId);
      const totalCost = updatedComponents.reduce((sum, c) => sum + c.extendedCost, 0);
      const updatedHeader = { ...bomHeader, estimatedCost: totalCost };
      saveLocalBom(updatedHeader, updatedComponents);
      return;
    }

    try {
      const res = await fetch(`/api/bom/headers/${bomHeader.id}/components/${componentId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        await fetchBomForProduct(bomHeader.model);
      } else {
        alert("Error al eliminar el componente.");
      }
    } catch {
      alert("Error de red al eliminar el componente.");
    }
  };

  const handleApproveBom = async () => {
    if (!bomHeader) return;
    if (bomComponents.length === 0) {
      alert("No se puede aprobar un BOM vacío. Añade componentes primero.");
      return;
    }

    if (localFallbackMode) {
      const updatedHeader = { 
        ...bomHeader, 
        status: "APPROVED",
        approvedBy: "Local User",
        approvedAt: new Date().toISOString()
      };
      saveLocalBom(updatedHeader, bomComponents);
      return;
    }

    try {
      const res = await fetch(`/api/bom/headers/${bomHeader.id}/approve`, {
        method: "POST",
        headers: { "x-user-id": "admin" }
      });
      if (res.ok) {
        await fetchBomForProduct(bomHeader.model);
      } else {
        alert("Error al aprobar el BOM.");
      }
    } catch {
      alert("Error de red.");
    }
  };

  const handleActivateBom = async () => {
    if (!bomHeader) return;

    if (localFallbackMode) {
      const updatedHeader = { ...bomHeader, status: "ACTIVE" };
      saveLocalBom(updatedHeader, bomComponents);
      // Update parent list
      setNpiList(npiList.map(item => item.id === bomHeader.model ? { ...item, status: "In Production" } : item));
      return;
    }

    try {
      const res = await fetch(`/api/bom/headers/${bomHeader.id}/activate`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchBomForProduct(bomHeader.model);
        // Update parent status in UI
        setNpiList(npiList.map(item => item.id === bomHeader.model ? { ...item, status: "In Production" } : item));
      } else {
        alert("Error al activar el BOM.");
      }
    } catch {
      alert("Error de red.");
    }
  };

  // --- NPI Save ---
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

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10",
      Draft: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10",
      Review: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
      PENDING_REVIEW: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
      APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
      Approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
      ACTIVE: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
      "In Production": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    };
    return colors[status] || colors.Draft;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] text-black dark:text-white font-sans p-6 md:p-10 lg:p-12 transition-all">
      <AnimatePresence mode="wait">
        
        {/* VIEW 1: PRODUCTS / NPI LIST */}
        {!activeBomProduct && (
          <motion.div
            key="list-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
          >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
              <div className="flex items-center gap-6">
                <Link href="/dashboard" className="p-3 bg-white dark:bg-[#111] border border-gray-200/50 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center">
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

            <div className="bg-white dark:bg-[#111] p-4 rounded-[2rem] border border-gray-200/50 dark:border-white/5 mb-8 flex flex-col md:flex-row gap-4 items-center">
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
                  className="bg-white dark:bg-[#111] border border-gray-200/50 dark:border-white/5 rounded-[2rem] p-6 shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                        <Cpu className="w-6 h-6 text-indigo-500" />
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(npi.status)}`}>
                        {npi.status}
                      </span>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="text-xl font-bold mb-1">{npi.name} <span className="text-sm font-light text-gray-400 ml-2">v{npi.version}</span></h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 min-h-[40px] font-light leading-relaxed">{npi.description}</p>
                      <p className="text-xs font-medium text-gray-400 mt-2">ID: {npi.id}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                      <div className="flex-1 text-center">
                        <p className="text-2xl font-bold">{npi.bomCount}</p>
                        <p className="text-[10px] uppercase text-gray-400 tracking-wider">BOM Items</p>
                      </div>
                      <div className="w-px h-8 bg-gray-200 dark:bg-white/10" />
                      <div className="flex-1 text-center flex flex-col items-center">
                        <GitBranch className="w-5 h-5 mb-1 text-gray-400" />
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
                      <button 
                        onClick={() => setActiveBomProduct(npi)}
                        className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-2"
                      >
                        <Layers className="w-3 h-3" /> Open BOM
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* VIEW 2: BOM EXPLORER & EDITOR */}
        {activeBomProduct && (
          <motion.div
            key="bom-view"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setActiveBomProduct(null)} 
                  className="p-3 bg-white dark:bg-[#111] border border-gray-200/50 dark:border-white/5 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{activeBomProduct.name}</h1>
                    <span className="font-mono text-xs font-bold text-gray-500 bg-gray-200/50 dark:bg-white/10 px-2 py-0.5 rounded">
                      {activeBomProduct.id}
                    </span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-light mt-0.5">Bill of Materials Configuration</p>
                </div>
              </div>
              
              {bomHeader && (
                <div className="flex items-center gap-3">
                  <span className={`px-4 py-2 border rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${getStatusBadge(bomHeader.status)}`}>
                    <span className={`w-2 h-2 rounded-full ${
                      bomHeader.status === 'ACTIVE' ? 'bg-blue-500' :
                      bomHeader.status === 'APPROVED' ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    {bomHeader.status}
                  </span>

                  {bomHeader.status === "DRAFT" && (
                    <button 
                      onClick={handleApproveBom}
                      className="px-6 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve BOM
                    </button>
                  )}

                  {bomHeader.status === "APPROVED" && (
                    <button 
                      onClick={handleActivateBom}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Activate BOM
                    </button>
                  )}

                  {(bomHeader.status === "ACTIVE" || bomHeader.status === "APPROVED") && (
                    <span className="p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-400" title="BOM is locked (Active/Approved)">
                      <Lock className="w-4 h-4" />
                    </span>
                  )}
                </div>
              )}
            </header>

            {/* Local Fallback warning */}
            {localFallbackMode && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 rounded-2xl text-xs flex gap-3 items-center">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <span className="font-bold">Offline Demo Mode</span> — El backend de base de datos no está disponible. Los datos se están guardando localmente en tu navegador (`localStorage`) para que puedas probar el flujo completo.
                </div>
              </div>
            )}

            {loadingBom ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                <p className="text-sm font-light">Loading BOM data...</p>
              </div>
            ) : !bomHeader ? (
              /* EMPTY STATE: NO BOM CREATED */
              <div className="bg-white dark:bg-[#111] border border-gray-200/50 dark:border-white/5 rounded-[2.5rem] p-12 text-center max-w-xl mx-auto my-10 shadow-sm">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Layers className="w-8 h-8 text-indigo-500" />
                </div>
                <h3 className="text-2xl font-bold mb-2">No Bill of Materials Found</h3>
                <p className="text-gray-500 dark:text-gray-400 font-light mb-8 max-w-sm mx-auto">
                  Este modelo de producto no tiene configurado ningún BOM de ingeniería o producción. Debes crear el encabezado para comenzar a definir los componentes.
                </p>
                <button
                  onClick={() => {
                    setBomForm({
                      bomType: "Manufacturing",
                      baseQuantity: 1,
                      baseUnit: "EA",
                      description: `BOM principal para el modelo ${activeBomProduct.id}`,
                      revision: "1.0"
                    });
                    setShowCreateBomModal(true);
                  }}
                  className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create BOM Header
                </button>
              </div>
            ) : (
              /* BOM EXPLORER VIEWS */
              <div className="space-y-6">
                {/* Header Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-[#111] p-6 border border-gray-200/50 dark:border-white/5 rounded-[2rem]">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Total Estimated Cost
                    </p>
                    <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
                      ${(bomHeader.estimatedCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-light">Suma ponderada de componentes</p>
                  </div>

                  <div className="bg-white dark:bg-[#111] p-6 border border-gray-200/50 dark:border-white/5 rounded-[2rem]">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">Revision & Type</p>
                    <p className="text-2xl font-bold">
                      v{bomHeader.revision || "1.0"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold tracking-wider text-indigo-500">
                      {bomHeader.bomType || "Manufacturing"}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-[#111] p-6 border border-gray-200/50 dark:border-white/5 rounded-[2rem]">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-2">Base Specification</p>
                    <p className="text-2xl font-bold">
                      {bomHeader.baseQuantity || 1} <span className="text-sm font-normal text-gray-500">{bomHeader.baseUnit || "EA"}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-light">Definición de escala</p>
                  </div>

                  <div className="bg-white dark:bg-[#111] p-6 border border-gray-200/50 dark:border-white/5 rounded-[2rem] md:col-span-1">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Details & Scope</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light leading-snug line-clamp-2">
                      {bomHeader.description || "Sin descripción adicional."}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-1">Creador: {bomHeader.createdBy || "System"}</p>
                  </div>
                </div>

                {/* Components Table Grid */}
                <div className="bg-white dark:bg-[#111] border border-gray-200/50 dark:border-white/5 rounded-[2.5rem] overflow-hidden shadow-sm">
                  <div className="p-6 md:p-8 border-b border-gray-200/50 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50 dark:bg-white/[0.01]">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">Componentes del BOM</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Listado estructurado de materiales requeridos</p>
                    </div>
                    {bomHeader.status === "DRAFT" && (
                      <button
                        onClick={() => {
                          setCompForm({
                            componentNumber: "",
                            quantity: 1,
                            unit: "EA",
                            usageFactor: 1,
                            level: 1,
                            referenceDesignator: "",
                            notes: "",
                            isPhantom: false
                          });
                          setSkuSearch("");
                          setEditingComponent(null);
                          setShowAddComponentModal(true);
                        }}
                        className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Component
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    {bomComponents.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                        <p className="text-sm font-light">Este BOM no tiene componentes configurados.</p>
                        {bomHeader.status === "DRAFT" && (
                          <p className="text-xs mt-1">Haz clic en "Add Component" para empezar a estructurarlo.</p>
                        )}
                      </div>
                    ) : (
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 text-[10px] font-bold uppercase tracking-wider border-b border-gray-200/50 dark:border-white/5">
                            <th className="px-6 py-4">Nivel</th>
                            <th className="px-6 py-4">Número de Parte</th>
                            <th className="px-6 py-4">Descripción</th>
                            <th className="px-6 py-4 text-right">Cantidad Req.</th>
                            <th className="px-6 py-4 text-center">Unidad</th>
                            <th className="px-6 py-4 text-right">Merma</th>
                            <th className="px-6 py-4 text-right">Costo Std.</th>
                            <th className="px-6 py-4 text-right">Costo Ext.</th>
                            <th className="px-6 py-4 text-center">Phantom</th>
                            {bomHeader.status === "DRAFT" && <th className="px-6 py-4 text-center">Acciones</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {bomComponents.map(comp => (
                            <tr key={comp.id} className="hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors">
                              <td className="px-6 py-4 font-bold text-xs text-indigo-500">
                                Lvl {comp.level || 1}
                              </td>
                              <td className="px-6 py-4 font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                                {comp.componentNumber}
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-semibold">{comp.description}</div>
                                {comp.referenceDesignator && (
                                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">Ref: {comp.referenceDesignator}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right font-bold">
                                {comp.quantity}
                              </td>
                              <td className="px-6 py-4 text-center text-xs text-gray-500">
                                {comp.unit || "EA"}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-xs text-gray-500">
                                x{comp.usageFactor || 1}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-xs text-gray-500">
                                ${(comp.standardCost || 0).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-xs font-bold text-gray-900 dark:text-white">
                                ${(comp.extendedCost || 0).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`inline-block w-2.5 h-2.5 rounded-full ${comp.isPhantom ? 'bg-amber-500' : 'bg-gray-200 dark:bg-white/10'}`} title={comp.isPhantom ? "Componente fantasma" : "Componente normal"} />
                              </td>
                              {bomHeader.status === "DRAFT" && (
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingComponent(comp);
                                        setCompForm({
                                          componentNumber: comp.componentNumber,
                                          quantity: comp.quantity,
                                          unit: comp.unit || "EA",
                                          usageFactor: comp.usageFactor || 1,
                                          level: comp.level || 1,
                                          referenceDesignator: comp.referenceDesignator || "",
                                          notes: comp.notes || "",
                                          isPhantom: comp.isPhantom || false
                                        });
                                        setSkuSearch(comp.componentNumber);
                                        setShowAddComponentModal(true);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveComponent(comp.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL 1: CREATE / EDIT NPI PRODUCT --- */}
      <AnimatePresence>
        {isModalOpen && editingNpi && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111] rounded-[2rem] p-8 max-w-lg w-full shadow-2xl border border-gray-200/50 dark:border-white/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{editingNpi.name ? 'Edit Product/NPI' : 'New Product/NPI'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 cursor-pointer">
                  <X className="w-4 h-4" />
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
                
                <button type="submit" className="w-full py-4 mt-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
                  <CheckCircle className="w-4 h-4" /> {editingNpi.name ? 'Save Changes' : 'Create Product'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: CREATE BOM HEADER --- */}
      <AnimatePresence>
        {showCreateBomModal && activeBomProduct && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111] rounded-[2rem] p-8 max-w-lg w-full shadow-2xl border border-gray-200/50 dark:border-white/5"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Crear Encabezado de BOM</h2>
                <button onClick={() => setShowCreateBomModal(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <form onSubmit={handleCreateBom} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Modelo</label>
                    <input type="text" disabled value={activeBomProduct.id} className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none opacity-50 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Revisión Inicial</label>
                    <input 
                      type="text" required 
                      value={bomForm.revision} 
                      onChange={e => setBomForm({...bomForm, revision: e.target.value})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Cantidad Base</label>
                    <input 
                      type="number" required min="0.001" step="any"
                      value={bomForm.baseQuantity} 
                      onChange={e => setBomForm({...bomForm, baseQuantity: Number(e.target.value)})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Unidad Base</label>
                    <input 
                      type="text" required 
                      value={bomForm.baseUnit} 
                      onChange={e => setBomForm({...bomForm, baseUnit: e.target.value.toUpperCase()})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Tipo de BOM</label>
                  <select 
                    value={bomForm.bomType} 
                    onChange={e => setBomForm({...bomForm, bomType: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                  >
                    <option value="Manufacturing">Manufacturing (Producción)</option>
                    <option value="Engineering">Engineering (Ingeniería)</option>
                    <option value="Prototype">Prototype (Prototipo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Descripción del BOM</label>
                  <textarea 
                    rows={3}
                    value={bomForm.description} 
                    onChange={e => setBomForm({...bomForm, description: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all resize-none"
                  />
                </div>
                
                <button type="submit" className="w-full py-4 mt-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
                  <CheckCircle className="w-4 h-4" /> Inicializar BOM
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: ADD / EDIT BOM COMPONENT --- */}
      <AnimatePresence>
        {showAddComponentModal && bomHeader && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#111] rounded-[2rem] p-8 max-w-lg w-full shadow-2xl border border-gray-200/50 dark:border-white/5 relative z-50"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">{editingComponent ? 'Editar Componente' : 'Añadir Componente al BOM'}</h2>
                <button 
                  onClick={() => {
                    setShowAddComponentModal(false);
                    setEditingComponent(null);
                  }} 
                  className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <form onSubmit={handleSaveComponent} className="space-y-4">
                {/* SKU Autocomplete Input */}
                <div className="relative">
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Número de Parte (Master Catalog)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" required
                      disabled={!!editingComponent}
                      placeholder="Buscar SKU o material..."
                      value={skuSearch}
                      onChange={e => {
                        setSkuSearch(e.target.value);
                        setCompForm({ ...compForm, componentNumber: e.target.value });
                        setShowSkuDropdown(true);
                      }}
                      onFocus={() => !editingComponent && setShowSkuDropdown(true)}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-65"
                    />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showSkuDropdown && !editingComponent && skuSearch.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl z-[60] divide-y divide-gray-100 dark:divide-white/5">
                      {catalog
                        .filter(m => m.partNumber.toLowerCase().includes(skuSearch.toLowerCase()) || m.description.toLowerCase().includes(skuSearch.toLowerCase()))
                        .map(m => (
                          <div
                            key={m.partNumber}
                            onClick={() => {
                              setCompForm({
                                ...compForm,
                                componentNumber: m.partNumber,
                                unit: m.uom || "EA"
                              });
                              setSkuSearch(m.partNumber);
                              setShowSkuDropdown(false);
                            }}
                            className="p-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/45 cursor-pointer text-xs flex justify-between items-center"
                          >
                            <div>
                              <span className="font-bold font-mono text-indigo-500">{m.partNumber}</span>
                              <span className="ml-2 font-medium text-gray-800 dark:text-gray-200">{m.description}</span>
                            </div>
                            <span className="font-mono text-gray-400 text-[10px]">${(m.standardCost || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      {catalog.filter(m => m.partNumber.toLowerCase().includes(skuSearch.toLowerCase()) || m.description.toLowerCase().includes(skuSearch.toLowerCase())).length === 0 && (
                        <div className="p-3 text-center text-xs text-gray-400">Sin coincidencias</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Cantidad Requerida</label>
                    <input 
                      type="number" required min="0.0001" step="any"
                      value={compForm.quantity} 
                      onChange={e => setCompForm({...compForm, quantity: Number(e.target.value)})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Unidad de Medida</label>
                    <input 
                      type="text" required 
                      value={compForm.unit} 
                      onChange={e => setCompForm({...compForm, unit: e.target.value.toUpperCase()})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Factor Merma</label>
                    <input 
                      type="number" required min="1" step="0.001"
                      value={compForm.usageFactor} 
                      onChange={e => setCompForm({...compForm, usageFactor: Number(e.target.value)})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Nivel Estructura</label>
                    <input 
                      type="number" required min="1"
                      value={compForm.level} 
                      onChange={e => setCompForm({...compForm, level: Number(e.target.value)})}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={compForm.isPhantom} 
                        onChange={e => setCompForm({...compForm, isPhantom: e.target.checked})}
                        className="w-4 h-4 rounded text-indigo-500 border-gray-200 focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="text-xs font-bold text-gray-500">¿Phantom?</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Designador de Referencia (ej: R1, R2, C1)</label>
                  <input 
                    type="text" 
                    value={compForm.referenceDesignator} 
                    onChange={e => setCompForm({...compForm, referenceDesignator: e.target.value})}
                    placeholder="Opcional"
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 mb-1 block">Notas de Ingeniería</label>
                  <textarea 
                    rows={2}
                    value={compForm.notes} 
                    onChange={e => setCompForm({...compForm, notes: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-black dark:focus:border-white transition-all resize-none"
                  />
                </div>
                
                <button type="submit" className="w-full py-4 mt-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer">
                  <CheckCircle className="w-4 h-4" /> {editingComponent ? 'Guardar Componente' : 'Añadir Componente'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
