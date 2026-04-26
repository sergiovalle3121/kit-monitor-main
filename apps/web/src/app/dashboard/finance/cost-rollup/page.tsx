'use client';

import { motion, Variants } from 'framer-motion';
import { ArrowLeft, Search, Package } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

// Sample data for cost rollup demonstration
const sampleProducts = [
  {
    sku: 'SKU-2055',
    name: 'Industrial Bearing Assembly',
    costs: {
      labor: 45.50,
      materials: 128.75,
      energy: 22.30,
      overhead: 38.90,
    },
  },
  {
    sku: 'SKU-3042',
    name: 'Hydraulic Pump Module',
    costs: {
      labor: 62.80,
      materials: 215.40,
      energy: 35.60,
      overhead: 52.15,
    },
  },
  {
    sku: 'SKU-1087',
    name: 'Control Valve Unit',
    costs: {
      labor: 38.20,
      materials: 95.60,
      energy: 18.45,
      overhead: 29.80,
    },
  },
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

const COST_CATEGORIES = [
  { key: 'labor', label: 'Mano de Obra', icon: '👷' },
  { key: 'materials', label: 'Materia Prima', icon: '📦' },
  { key: 'energy', label: 'Energía', icon: '⚡' },
  { key: 'overhead', label: 'Gastos Fijos', icon: '🏭' },
];

export default function CostRollupPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(sampleProducts[0]);

  const filteredProducts = useMemo(() => {
    return sampleProducts.filter(
      (p) =>
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const totalCost = useMemo(() => {
    if (!selectedProduct) return 0;
    const { labor, materials, energy, overhead } = selectedProduct.costs;
    return labor + materials + energy + overhead;
  }, [selectedProduct]);

  const pieData = useMemo(() => {
    if (!selectedProduct) return [];
    return COST_CATEGORIES.map((cat) => ({
      name: cat.label,
      value: selectedProduct.costs[cat.key as keyof typeof selectedProduct.costs],
    }));
  }, [selectedProduct]);

  const barData = useMemo(() => {
    if (!selectedProduct) return [];
    return COST_CATEGORIES.map((cat) => ({
      category: cat.label,
      cost: selectedProduct.costs[cat.key as keyof typeof selectedProduct.costs],
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
                    onClick={() => setSelectedProduct(product)}
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

          {/* Middle Column: Cost Breakdown Cards */}
          <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
            <div className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-2xl p-5 shadow-lg">
              <h3 className="text-sm font-medium text-gray-300 mb-4 tracking-wide">Desglose de Costos</h3>
              <div className="space-y-3">
                {COST_CATEGORIES.map((cat, index) => {
                  const value = selectedProduct?.costs[cat.key as keyof typeof selectedProduct.costs] || 0;
                  const percentage = totalCost > 0 ? (value / totalCost) * 100 : 0;
                  return (
                    <motion.div
                      key={cat.key}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{cat.icon}</span>
                        <div>
                          <p className="text-white text-sm font-medium">{cat.label}</p>
                          <p className="text-gray-400 text-xs">{percentage.toFixed(1)}% del total</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-300 font-semibold">${value.toFixed(2)}</p>
                      </div>
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
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Costo']}
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
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Costo']}
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

        {/* Bottom Gradient Line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      </motion.div>
    </div>
  );
}
