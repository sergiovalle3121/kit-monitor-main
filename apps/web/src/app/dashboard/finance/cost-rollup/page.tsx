'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ArrowLeft, Search, Package, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export interface CostBreakdownItem {
  id: string;
  name: string;
  partNumber?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  workOrder?: string;
  postedAt: string;
}

export interface ProductCostRollup {
  sku: string;
  name: string;
  costs: {
    labor: number;
    materials: number;
    energy: number;
    overhead: number;
  };
  breakdown: {
    labor: CostBreakdownItem[];
    materials: CostBreakdownItem[];
    energy: CostBreakdownItem[];
    overhead: CostBreakdownItem[];
  };
  totalCost: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

const COST_CATEGORIES = [
  { key: 'labor', label: 'Mano de Obra', icon: '👷' },
  { key: 'materials', label: 'Materia Prima', icon: '📦' },
  { key: 'energy', label: 'Energía', icon: '⚡' },
  { key: 'overhead', label: 'Gastos Fijos', icon: '🏭' },
];

async function fetchCostRollup(sku: string): Promise<ProductCostRollup> {
  const response = await fetch(`/api/accounting/cost-rollup?sku=${encodeURIComponent(sku)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch cost rollup');
  }
  return response.json();
}

export default function CostRollupPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductCostRollup | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const availableProducts = useMemo(() => [
    { sku: 'SKU-2055', name: 'Industrial Bearing Assembly' },
    { sku: 'SKU-3042', name: 'Hydraulic Pump Module' },
    { sku: 'SKU-1087', name: 'Control Valve Unit' },
  ], []);

  const filteredProducts = useMemo(() => {
    return availableProducts.filter(
      (p) =>
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, availableProducts]);

  const handleSelectProduct = useCallback(async (sku: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCostRollup(sku);
      setSelectedProduct(data);
    } catch (err) {
      setError('No se pudo cargar los datos del producto. Asegúrate de que la API esté disponible.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const totalCost = useMemo(() => {
    if (!selectedProduct) return 0;
    return selectedProduct.totalCost;
  }, [selectedProduct]);

  const pieData = useMemo(() => {
    if (!selectedProduct) return [];
    return COST_CATEGORIES.map((cat) => ({
      name: cat.label,
      value: selectedProduct.costs[cat.key as keyof typeof selectedProduct.costs] || 0,
    }));
  }, [selectedProduct]);

  const barData = useMemo(() => {
    if (!selectedProduct) return [];
    return COST_CATEGORIES.map((cat) => ({
      category: cat.label,
      cost: selectedProduct.costs[cat.key as keyof typeof selectedProduct.costs] || 0,
    }));
  }, [selectedProduct]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  const breakdownItemVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: { 
      opacity: 1, 
      height: 'auto',
      transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] }
    },
    exit: { 
      opacity: 0, 
      height: 0,
      transition: { duration: 0.2 }
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      {/* Glassmorphism Container */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-6 md:p-10 max-w-7xl mx-auto overflow-hidden"
      >
        {/* Ambient Glow Effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/30 rounded-full blur-3xl" />

        {/* Header with Back Button */}
        <motion.div variants={itemVariants} className="relative z-10 mb-8">
          <Link href="/dashboard/finance">
            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
              whileTap={{ scale: 0.95 }}
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 text-white font-medium tracking-wide backdrop-blur-sm shadow-lg hover:shadow-xl hover:shadow-emerald-500/20 transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
              <span>Regresar al Hub</span>
            </motion.button>
          </Link>
        </motion.div>

        {/* Title Section */}
        <motion.div variants={itemVariants} className="relative z-10 text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-light tracking-wide text-white mb-2">
            Industrial Cost Roll-up Explorer
          </h1>
          <p className="text-lg md:text-xl font-extralight tracking-[0.15em] text-emerald-200/80 uppercase">
            Análisis de Costos de Fabricación
          </p>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="w-32 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent mx-auto mt-6"
          />
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-20"
          >
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
            <span className="ml-4 text-white font-medium">Cargando datos del producto...</span>
          </motion.div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="backdrop-blur-xl bg-red-500/10 border border-red-400/30 rounded-2xl p-6 text-center"
          >
            <p className="text-red-300 font-medium">{error}</p>
            <p className="text-red-400/70 text-sm mt-2">Los datos de ejemplo se mostrarán a continuación.</p>
          </motion.div>
        )}

        {!isLoading && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8"
          >
            {/* Left Column: Search & Product List */}
            <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
              {/* Premium Search Input */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-emerald-300" strokeWidth={1.5} />
                  <input
                    type="text"
                    placeholder="Buscar producto por SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-gray-400 text-sm tracking-wide"
                  />
                </div>
              </div>

              {/* Product List */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-4 shadow-lg max-h-96 overflow-y-auto">
                <h3 className="text-sm font-medium text-gray-300 mb-3 tracking-wide">Productos Disponibles</h3>
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <motion.button
                      key={product.sku}
                      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectProduct(product.sku)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-300 ${
                        selectedProduct?.sku === product.sku
                          ? 'bg-emerald-500/20 border-emerald-400/40 shadow-lg shadow-emerald-500/10'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-emerald-300" strokeWidth={1.5} />
                        <div>
                          <p className="text-white font-medium text-sm">{product.sku}</p>
                          <p className="text-gray-400 text-xs truncate">{product.name}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Middle Column: Cost Breakdown Cards with Drill-down */}
            <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
              <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-5 shadow-lg">
                <h3 className="text-sm font-medium text-gray-300 mb-4 tracking-wide">Desglose de Costos</h3>
                <div className="space-y-3">
                  {COST_CATEGORIES.map((cat, index) => {
                    const value = selectedProduct?.costs[cat.key as keyof typeof selectedProduct.costs] || 0;
                    const percentage = totalCost > 0 ? (value / totalCost) * 100 : 0;
                    const isExpanded = expandedCategory === cat.key;
                    const breakdownItems = selectedProduct?.breakdown[cat.key as keyof typeof selectedProduct.breakdown] || [];

                    return (
                      <motion.div
                        key={cat.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
                        className="rounded-xl border border-white/10 overflow-hidden"
                      >
                        {/* Category Header - Clickable */}
                        <motion.button
                          whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
                          onClick={() => toggleCategory(cat.key)}
                          className="w-full flex items-center justify-between p-3 bg-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{cat.icon}</span>
                            <div className="text-left">
                              <p className="text-white text-sm font-medium">{cat.label}</p>
                              <p className="text-gray-400 text-xs">{percentage.toFixed(1)}% del total</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-emerald-300 font-semibold">${value.toFixed(2)}</p>
                            </div>
                            {breakdownItems.length > 0 && (
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              </motion.div>
                            )}
                          </div>
                        </motion.button>

                        {/* Drill-down Details */}
                        <AnimatePresence>
                          {isExpanded && breakdownItems.length > 0 && (
                            <motion.div
                              variants={breakdownItemVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              className="bg-black/20 border-t border-white/10"
                            >
                              <div className="p-3 space-y-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                  Detalle de {cat.label}
                                </p>
                                {breakdownItems.map((item, idx) => (
                                  <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="text-xs p-2 rounded-lg bg-white/5 border border-white/5"
                                  >
                                    <div className="flex justify-between items-start mb-1">
                                      <span className="text-white font-medium">{item.name}</span>
                                      <span className="text-emerald-300 font-semibold">${item.totalCost.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-400">
                                      <span>{item.partNumber || item.workOrder || 'N/A'}</span>
                                      <span>{item.quantity} × ${item.unitCost.toFixed(2)}</span>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Total Cost Display */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                  className="mt-5 pt-4 border-t border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm font-medium">Costo Total</span>
                    <span className="text-2xl font-bold text-emerald-300">${totalCost.toFixed(2)}</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Right Column: Charts */}
            <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
              {/* Pie Chart */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-5 shadow-lg">
                <h3 className="text-sm font-medium text-gray-300 mb-4 tracking-wide">Distribución de Costos</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Costo']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs text-gray-300">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar Chart */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-5 shadow-lg">
                <h3 className="text-sm font-medium text-gray-300 mb-4 tracking-wide">Comparativa Visual</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis
                        dataKey="category"
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Costo']}
                      />
                      <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Bottom Gradient Line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      </motion.div>
    </div>
  );
}
