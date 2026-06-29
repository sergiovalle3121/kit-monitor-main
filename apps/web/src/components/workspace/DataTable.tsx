'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type RowData,
  type Table,
} from '@tanstack/react-table';
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Columns3,
  Rows3,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { glass } from '@/lib/glass';
import { Popover } from '@/components/ui';

// Meta tipada por columna: alineación, si admite filtro de columna y su
// placeholder. Augmentación recomendada por @tanstack/react-table.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: 'left' | 'right' | 'center';
    filterable?: boolean;
    filterPlaceholder?: string;
    // Marcador para evitar el aviso de tipos sin usar de la augmentación.
    __t?: [TData, TValue];
  }
}

type Density = 'comfortable' | 'compact';

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Id estable de fila (recomendado para mantener la selección entre páginas). */
  getRowId?: (row: T, index: number) => string;
  isLoading?: boolean;
  /** Se muestra cuando el dataset está vacío (tras cargar): el EmptyState que invita. */
  emptyState?: ReactNode;
  /** Click en una fila completa (abre el DetailDrawer). */
  onRowClick?: (row: T) => void;
  /** Caja de búsqueda global integrada (en la barra de la tabla). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Búsqueda global controlada desde fuera (p.ej. desde el Toolbar). */
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  /** Emite las filas filtradas+ordenadas (sin paginar) para exportar respetando filtros. */
  onFilteredRowsChange?: (rows: T[]) => void;
  /** Selección múltiple (checkbox) + barra de acciones en lote. */
  enableSelection?: boolean;
  renderBulkActions?: (selected: T[], reset: () => void) => ReactNode;
  /** Filtros por columna (el embudo muestra/oculta la fila de filtros). */
  enableColumnFilters?: boolean;
  /** Menú de visibilidad de columnas. */
  enableColumnVisibility?: boolean;
  /** Toggle de densidad cómoda/compacta. */
  enableDensityToggle?: boolean;
  initialDensity?: Density;
  pageSize?: number;
  /** Controles extra a la derecha de la barra (p.ej. Export). */
  toolbarRight?: ReactNode;
  className?: string;
}

const CONTROL =
  'inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors hover:bg-black/5 hover:text-black dark:text-muted-foreground dark:hover:bg-white/10 dark:hover:text-white';

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded accent-indigo-600"
    />
  );
}

/**
 * Tabla industrial genérica del Workspace Industrial. Núcleo headless
 * (@tanstack/react-table) + estilo Tailwind/glass. Orden por columna, búsqueda
 * global, filtros por columna, paginación, selección múltiple con barra de
 * acciones en lote, visibilidad de columnas, densidad y skeleton de carga.
 */
export function DataTable<T>({
  data,
  columns,
  getRowId,
  isLoading = false,
  emptyState,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Buscar…',
  globalFilter: controlledGlobalFilter,
  onGlobalFilterChange,
  onFilteredRowsChange,
  enableSelection = false,
  renderBulkActions,
  enableColumnFilters = true,
  enableColumnVisibility = true,
  enableDensityToggle = true,
  initialDensity = 'comfortable',
  pageSize = 10,
  toolbarRight,
  className = '',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalGlobalFilter, setInternalGlobalFilter] = useState('');
  const isGlobalControlled = controlledGlobalFilter !== undefined;
  const globalFilter = isGlobalControlled ? controlledGlobalFilter : internalGlobalFilter;
  const setGlobalFilter = (next: string) =>
    isGlobalControlled ? onGlobalFilterChange?.(next) : setInternalGlobalFilter(next);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  const [density, setDensity] = useState<Density>(initialDensity);
  const [showFilters, setShowFilters] = useState(false);

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!enableSelection) return columns;
    const select: ColumnDef<T, unknown> = {
      id: '__select',
      enableSorting: false,
      enableHiding: false,
      enableColumnFilter: false,
      size: 40,
      header: ({ table }) => (
        <IndeterminateCheckbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          label="Seleccionar todo"
        />
      ),
      cell: ({ row }) => (
        <IndeterminateCheckbox
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          label="Seleccionar fila"
        />
      ),
    };
    return [select, ...columns];
  }, [columns, enableSelection]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table intentionally returns mutable table helpers; this component keeps them local and does not pass them into memoized React Compiler boundaries.
  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, columnFilters, globalFilter, columnVisibility, rowSelection, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: (updater) => {
      const next = typeof updater === 'function' ? (updater as (old: string) => string)(globalFilter) : updater;
      setGlobalFilter((next as string) ?? '');
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    enableRowSelection: enableSelection,
    globalFilterFn: 'includesString',
  });

  // Eleva las filas filtradas+ordenadas (sin paginar) para que un Export externo
  // respete TODOS los filtros. Vía ref para no acoplar el efecto a la identidad
  // (cambiante) del `table` ni del callback, evitando renders en cascada.
  const onFilteredRef = useRef(onFilteredRowsChange);
  onFilteredRef.current = onFilteredRowsChange;
  useEffect(() => {
    onFilteredRef.current?.(table.getFilteredRowModel().rows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, globalFilter, columnFilters, sorting]);

  const leafCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const noData = !isLoading && data.length === 0;
  const noMatch = !isLoading && data.length > 0 && rows.length === 0;
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const cellPad = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-2.5';

  const hideableColumns = table.getAllLeafColumns().filter((c) => c.getCanHide() && c.id !== '__select');
  const anyColumnFilterable = table
    .getAllLeafColumns()
    .some((c) => c.getCanFilter() && c.columnDef.meta?.filterable);

  return (
    <div className={clsx(glass, 'overflow-hidden rounded-2xl', className)}>
      {/* Barra de controles */}
      <div className="flex items-center justify-between gap-2 border-b border-black/5 px-3 py-2 dark:border-white/10">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {searchable && (
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Búsqueda global"
                className="h-9 w-full rounded-xl border border-black/10 bg-black/[0.03] pl-8 pr-3 text-sm outline-none transition-colors focus:border-indigo-500 dark:border-white/10 dark:bg-white/[0.04]"
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {enableColumnFilters && anyColumnFilterable && (
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              className={clsx(CONTROL, showFilters && 'bg-black/5 text-black dark:bg-white/10 dark:text-white')}
              aria-pressed={showFilters}
              title="Filtros por columna"
            >
              <ListFilter className="h-4 w-4" /> Filtros
            </button>
          )}

          {enableColumnVisibility && hideableColumns.length > 0 && (
            // Popover portado + opaco + viewport-aware (primitivo compartido); no
            // es `menu` para que marcar/desmarcar columnas no lo cierre.
            <Popover
              align="end"
              className="max-h-72 w-52"
              trigger={
                <button type="button" className={CONTROL} title="Columnas">
                  <Columns3 className="h-4 w-4" /> Columnas
                </button>
              }
            >
              {hideableColumns.map((col) => {
                const header = col.columnDef.header;
                const label = typeof header === 'string' ? header : col.id;
                return (
                  <label
                    key={col.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={col.getIsVisible()}
                      onChange={col.getToggleVisibilityHandler()}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    {label}
                  </label>
                );
              })}
            </Popover>
          )}

          {enableDensityToggle && (
            <button
              type="button"
              onClick={() => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))}
              className={clsx(CONTROL, density === 'compact' && 'bg-black/5 text-black dark:bg-white/10 dark:text-white')}
              title={density === 'compact' ? 'Densidad cómoda' : 'Densidad compacta'}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          )}

          {toolbarRight}
        </div>
      </div>

      {/* Barra de acciones en lote */}
      {enableSelection && selected.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b border-indigo-500/15 bg-indigo-500/[0.06] px-3 py-2">
          <span className="text-[13px] font-medium text-indigo-600 dark:text-indigo-300">
            {selected.length} seleccionado{selected.length === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            {renderBulkActions?.(selected, () => table.resetRowSelection())}
            <button
              type="button"
              onClick={() => table.resetRowSelection()}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-muted-foreground hover:bg-black/5 dark:text-muted-foreground dark:hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" /> Limpiar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-black/5 dark:border-white/10">
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  const align = h.column.columnDef.meta?.align;
                  const size = h.column.columnDef.size;
                  const filterable = enableColumnFilters && h.column.getCanFilter() && h.column.columnDef.meta?.filterable;
                  return (
                    <th
                      key={h.id}
                      style={size ? { width: size } : undefined}
                      className={clsx(
                        'px-3 py-2.5 align-bottom text-[11px] font-medium uppercase tracking-wide text-muted-foreground dark:text-muted-foreground',
                        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
                      )}
                    >
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={clsx(
                            'inline-flex items-center gap-1 transition-colors hover:text-foreground',
                            align === 'right' && 'flex-row-reverse',
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : sorted === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}

                      {showFilters && filterable && (
                        <input
                          value={(h.column.getFilterValue() as string) ?? ''}
                          onChange={(e) => h.column.setFilterValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={h.column.columnDef.meta?.filterPlaceholder ?? 'Filtrar'}
                          className="mt-1.5 w-full rounded-lg border border-black/10 bg-black/[0.03] px-2 py-1 text-[12px] font-normal normal-case tracking-normal outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/[0.04]"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-black/5 dark:border-white/5">
                  {Array.from({ length: leafCount }).map((__, j) => (
                    <td key={`sk-${i}-${j}`} className={cellPad}>
                      <div className="h-3.5 w-full max-w-[8rem] animate-pulse rounded bg-black/10 dark:bg-white/10" />
                    </td>
                  ))}
                </tr>
              ))
            ) : noData ? (
              <tr>
                <td colSpan={leafCount} className="p-0">
                  {emptyState ?? (
                    <div className="p-12 text-center text-sm text-muted-foreground">Sin registros.</div>
                  )}
                </td>
              </tr>
            ) : noMatch ? (
              <tr>
                <td colSpan={leafCount} className="p-10 text-center text-sm text-muted-foreground">
                  Sin resultados para los filtros aplicados.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter') onRowClick(row.original);
                        }
                      : undefined
                  }
                  className={clsx(
                    'border-b border-black/5 transition-colors dark:border-white/5',
                    onRowClick && 'cursor-pointer',
                    row.getIsSelected()
                      ? 'bg-indigo-500/[0.06]'
                      : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]',
                  )}
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = cell.column.columnDef.meta?.align;
                    return (
                      <td
                        key={cell.id}
                        className={clsx(
                          cellPad,
                          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!isLoading && rows.length > 0 && <PaginationBar table={table} total={table.getFilteredRowModel().rows.length} />}
    </div>
  );
}

function PaginationBar<T>({ table, total }: { table: Table<T>; total: number }) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);
  const pageCount = table.getPageCount();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 px-3 py-2.5 text-[13px] text-muted-foreground dark:border-white/10 dark:text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>
          {from}–{to} de {total}
        </span>
        <select
          value={pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          aria-label="Filas por página"
          className="h-7 rounded-lg border border-black/10 bg-black/[0.03] px-1.5 text-[12px] outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-white/[0.04]"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / pág
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-1 tabular-nums">
          Pág {pageIndex + 1} / {Math.max(1, pageCount)}
        </span>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
