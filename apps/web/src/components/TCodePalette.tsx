'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface TCodeResult {
  success: boolean;
  data?: Record<string, unknown>;
  message: string;
  action?: string;
}

interface TCodeInfo {
  code: string;
  description: string;
  category: string;
}

export function TCodePalette() {
  const router = useRouter();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TCodeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  // Abrir con Ctrl/Cmd+K o F1, o desde la barra de búsqueda (evento 'axos:open-search').
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || e.key === 'F1') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('axos:open-search', handleOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('axos:open-search', handleOpen);
    };
  }, []);

  // Búsqueda en tiempo real
  useEffect(() => {
    if (!isOpen) return;
    const debounce = setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      const searchTCodes = async () => {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`/api/tcode/search?q=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = (await res.json()) as TCodeInfo[];
            setResults(data);
            setSelected(0);
          }
        } catch (error) {
          console.error('Error searching T-Codes:', error);
        } finally {
          setIsLoading(false);
        }
      };
      void searchTCodes();
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, isOpen]);

  // Ejecutar T-Code
  const executeTCode = useCallback(async (code: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/tcode/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tcode: code }),
      });

      if (res.ok) {
        const result: TCodeResult = await res.json();

        // Navegación directa a una pantalla (ERP HUB y otros)
        if (result.action === 'NAVIGATE' && result.data?.route) {
          setIsOpen(false);
          setQuery('');
          router.push(result.data.route as string);
          return;
        }

        // Mostrar resultado según el tipo de acción
        if (result.action === 'VIEW_STOCK') {
          // Aquí se podría abrir un modal o panel con los datos de stock
          toast.info(`Stock:\n${JSON.stringify(result.data?.materials, null, 2)}`);
        }

        setIsOpen(false);
        setQuery('');
      }
    } catch (error) {
      console.error('Error executing T-Code:', error);
    }
  }, [router, toast]);

  // Navegación por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      e.preventDefault();
      executeTCode(results[selected].code);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Command className="w-5 h-5 text-blue-500" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un T-Code (ej: MB52) o descripción (ej: ver stock)..."
            className="flex-1 bg-transparent outline-none text-lg text-gray-900 dark:text-white placeholder-gray-400"
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 rounded">
            ESC para cerrar
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-8 text-center text-gray-500">
              Buscando T-Codes...
            </div>
          )}

          {!isLoading && query && results.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              No se encontraron T-Codes. Prueba con otro término.
            </div>
          )}

          {!isLoading && !query && (
            <div className="px-4 py-8 text-center text-gray-500">
              <p className="mb-2">Atajos rápidos:</p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => executeTCode('MB52')}
                  className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                >
                  MB52 - Stock
                </button>
                <button
                  onClick={() => executeTCode('CO03')}
                  className="px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition"
                >
                  CO03 - Producción
                </button>
                <button
                  onClick={() => executeTCode('ME23N')}
                  className="px-3 py-1.5 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition"
                >
                  ME23N - Compras
                </button>
              </div>
            </div>
          )}

          {results.map((item, index) => (
            <button
              key={item.code}
              onClick={() => executeTCode(item.code)}
              className={`w-full px-4 py-3 flex items-center gap-3 transition ${
                index === selected
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex-shrink-0 w-16 font-mono font-bold text-blue-600 dark:text-blue-400">
                {item.code}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-gray-900 dark:text-white">
                  {item.description}
                </div>
                <div className="text-sm text-gray-500">{item.category}</div>
              </div>
              {index === selected && (
                <div className="text-xs text-gray-400">Enter ↵</div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>↑↓ navegar</span>
            <span>↵ ejecutar</span>
            <span>esc cerrar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
