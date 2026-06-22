/**
 * Workspace Industrial — kit de primitivos de UI para datos, compartido por
 * todos los módulos. Construido UNA vez para acabar con la duplicación (cada
 * página profunda rodaba su propia tabla/filtros/KPIs) y la austeridad. Headless
 * donde aplica (DataTable sobre @tanstack/react-table) y estilizado con el
 * lenguaje visual existente (glass, IconTile, acento, dark mode).
 *
 * Genéricos y reutilizables: ningún componente está acoplado a un módulo
 * concreto. Legal es la implementación de referencia.
 */
export { StatCard, type StatCardProps } from './StatCard';
export { KpiRow } from './KpiRow';
export { EmptyState, type EmptyStateProps, type EmptyStateAction } from './EmptyState';
export { Toolbar } from './Toolbar';
export {
  FilterBar,
  type FilterDef,
  type FilterValues,
  type FilterValue,
  type DateRange,
} from './FilterBar';
export { ExportButton, type ExportColumn, type ExportButtonProps, type ExportFormat } from './ExportButton';
export {
  DetailDrawer,
  DrawerSection,
  DrawerField,
  type DetailDrawerProps,
} from './DetailDrawer';
export { DataTable, type DataTableProps } from './DataTable';
