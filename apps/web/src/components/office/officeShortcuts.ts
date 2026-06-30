export type OfficeShortcutEditorType = 'doc' | 'sheet' | 'slides';

export type OfficeShortcutAvailability =
  | 'available'
  | 'focus-dependent'
  | 'read-only-blocked'
  | 'native';

export interface OfficeShortcutCommand {
  id: string;
  group: string;
  label: string;
  keys: string;
  availability: OfficeShortcutAvailability;
  note: string;
  blockedWhenReadOnly?: boolean;
}

export interface OfficeShortcutGroup {
  title: string;
  commands: OfficeShortcutCommand[];
}

export const OFFICE_SHORTCUT_AVAILABILITY_LABELS: Record<OfficeShortcutAvailability, string> = {
  available: 'Disponible',
  'focus-dependent': 'Requiere foco',
  'read-only-blocked': 'Solo lectura',
  native: 'Nativo',
};

const COMMON_SHORTCUTS: OfficeShortcutCommand[] = [
  {
    id: 'save',
    group: 'Archivo',
    label: 'Guardar ahora',
    keys: 'Ctrl / Cmd + S',
    availability: 'available',
    note: 'Usa el guardado inmediato de Office y evita el dialogo del navegador.',
    blockedWhenReadOnly: true,
  },
  {
    id: 'shortcuts',
    group: 'Ayuda',
    label: 'Abrir atajos',
    keys: 'Ctrl / Cmd + /',
    availability: 'available',
    note: 'Abre este panel de comandos del editor activo.',
  },
  {
    id: 'close-dialog',
    group: 'Ayuda',
    label: 'Cerrar paneles',
    keys: 'Esc',
    availability: 'available',
    note: 'Cierra este panel y varios popovers del ribbon.',
  },
  {
    id: 'browser-fullscreen',
    group: 'Vista',
    label: 'Pantalla completa del navegador',
    keys: 'F11',
    availability: 'native',
    note: 'Lo controla el navegador; el boton de Office usa la Fullscreen API.',
  },
];

const DOC_SHORTCUTS: OfficeShortcutCommand[] = [
  {
    id: 'doc-find',
    group: 'Edicion',
    label: 'Buscar y reemplazar',
    keys: 'Ctrl / Cmd + F',
    availability: 'available',
    note: 'Abre el buscador del documento, no la busqueda del navegador.',
  },
  {
    id: 'doc-bold',
    group: 'Formato',
    label: 'Negrita / cursiva / subrayado',
    keys: 'Ctrl / Cmd + B / I / U',
    availability: 'focus-dependent',
    note: 'Lo resuelve el editor TipTap cuando el cursor esta dentro del documento.',
    blockedWhenReadOnly: true,
  },
  {
    id: 'doc-page-break',
    group: 'Edicion',
    label: 'Salto de pagina',
    keys: 'Ctrl / Cmd + Enter',
    availability: 'focus-dependent',
    note: 'Inserta salto de pagina desde la extension del editor de documentos.',
    blockedWhenReadOnly: true,
  },
];

const SHEET_SHORTCUTS: OfficeShortcutCommand[] = [
  {
    id: 'sheet-find',
    group: 'Analisis',
    label: 'Buscar y reemplazar en workbook',
    keys: 'Ctrl / Cmd + F',
    availability: 'available',
    note: 'Abre el buscador de AXOS Sheets para hojas y rangos.',
    blockedWhenReadOnly: true,
  },
  {
    id: 'sheet-print',
    group: 'Archivo',
    label: 'Vista previa de impresion',
    keys: 'Ctrl / Cmd + P',
    availability: 'available',
    note: 'Abre el flujo de impresion de Sheets antes del dialogo del navegador.',
  },
  {
    id: 'sheet-undo',
    group: 'Edicion',
    label: 'Deshacer / rehacer',
    keys: 'Ctrl / Cmd + Z / Y',
    availability: 'focus-dependent',
    note: 'La rejilla lo maneja con foco; Office lo reenvia si el foco salio al ribbon.',
    blockedWhenReadOnly: true,
  },
  {
    id: 'sheet-clipboard',
    group: 'Edicion',
    label: 'Copiar / cortar / pegar',
    keys: 'Ctrl / Cmd + C / X / V',
    availability: 'focus-dependent',
    note: 'Office devuelve el foco a la celda activa para que Fortune-Sheet procese el portapapeles.',
    blockedWhenReadOnly: true,
  },
  {
    id: 'sheet-delete',
    group: 'Edicion',
    label: 'Borrar contenido de celda',
    keys: 'Del / Backspace',
    availability: 'focus-dependent',
    note: 'Lo ejecuta la rejilla cuando una celda o rango esta activo.',
    blockedWhenReadOnly: true,
  },
  {
    id: 'sheet-formula-commit',
    group: 'Formula bar',
    label: 'Confirmar formula o valor',
    keys: 'Enter',
    availability: 'focus-dependent',
    note: 'Confirma lo escrito en la barra fx para la celda seleccionada.',
    blockedWhenReadOnly: true,
  },
  {
    id: 'sheet-formula-cancel',
    group: 'Formula bar',
    label: 'Cancelar edicion fx',
    keys: 'Esc',
    availability: 'focus-dependent',
    note: 'Sale del modo de edicion de la barra fx sin escribir otro valor.',
  },
];

const SLIDE_SHORTCUTS: OfficeShortcutCommand[] = [
  {
    id: 'slides-arrows',
    group: 'Presentacion',
    label: 'Anterior / siguiente diapositiva',
    keys: 'Left / Right',
    availability: 'focus-dependent',
    note: 'Navega durante la presentacion o cuando el canvas captura las teclas.',
  },
  {
    id: 'slides-notes',
    group: 'Presentacion',
    label: 'Notas del orador',
    keys: 'N',
    availability: 'focus-dependent',
    note: 'Alterna notas mientras la presentacion esta activa.',
  },
  {
    id: 'slides-duplicate',
    group: 'Edicion',
    label: 'Duplicar elemento',
    keys: 'Ctrl / Cmd + D',
    availability: 'focus-dependent',
    note: 'Duplica el objeto seleccionado en el editor de slides.',
    blockedWhenReadOnly: true,
  },
  {
    id: 'slides-group',
    group: 'Edicion',
    label: 'Agrupar / desagrupar',
    keys: 'Ctrl / Cmd + G / Shift + G',
    availability: 'focus-dependent',
    note: 'Agrupa objetos seleccionados cuando el canvas tiene foco.',
    blockedWhenReadOnly: true,
  },
];

function shortcutsFor(type: OfficeShortcutEditorType): OfficeShortcutCommand[] {
  if (type === 'doc') return DOC_SHORTCUTS;
  if (type === 'sheet') return SHEET_SHORTCUTS;
  return SLIDE_SHORTCUTS;
}

function availabilityFor(command: OfficeShortcutCommand, readOnly: boolean): OfficeShortcutAvailability {
  return readOnly && command.blockedWhenReadOnly ? 'read-only-blocked' : command.availability;
}

export function getOfficeShortcutGroups(type: OfficeShortcutEditorType, readOnly = false): OfficeShortcutGroup[] {
  const byGroup = new Map<string, OfficeShortcutCommand[]>();
  for (const command of [...COMMON_SHORTCUTS, ...shortcutsFor(type)]) {
    const next = { ...command, availability: availabilityFor(command, readOnly) };
    byGroup.set(next.group, [...(byGroup.get(next.group) ?? []), next]);
  }
  return [...byGroup.entries()].map(([title, commands]) => ({ title, commands }));
}
