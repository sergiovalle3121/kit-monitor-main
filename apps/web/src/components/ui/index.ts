/**
 * Primitivos de UI compartidos de AXOS — punto único de importación.
 *
 * Creados durante el barrido visual (ver `docs/VISUAL-QA-REPORT.md`) para atacar
 * las causas raíz de los defectos de UI: modales que no se podían cerrar,
 * colapsables descuadrados y dropdowns transparentes que cruzaban texto. Todos
 * tematizados con los tokens de `globals.css` (claro/oscuro) y accesibles.
 */
export { Modal, type ModalProps, type ModalSize } from './Modal';
export { Collapsible, type CollapsibleProps } from './Collapsible';
export {
  Popover,
  DropdownMenu,
  DropdownItem,
  DropdownSeparator,
  type PopoverProps,
} from './Popover';
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
} from './Card';
