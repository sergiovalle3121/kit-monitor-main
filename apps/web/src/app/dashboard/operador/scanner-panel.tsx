import {
  BluetoothConnected,
  History,
  Keyboard,
  QrCode,
  ScanLine,
  Usb,
  Volume2,
} from "lucide-react";
import { glass } from "@/lib/glass";
import type { ScanResult, ScanState } from "./operator-terminal.utils";

const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const GRAY = "#6b7280";

export function ScannerPanel({
  state,
  lastScan,
  history,
  expected,
  compact = false,
}: {
  state: ScanState;
  lastScan: ScanResult | null;
  history: ScanResult[];
  expected: string;
  compact?: boolean;
}) {
  const stateMeta =
    state === "reading"
      ? { label: "Leyendo scanner…", color: AMBER }
      : state === "valid"
        ? { label: "Lectura válida", color: GREEN }
        : state === "invalid"
          ? { label: "Lectura inválida", color: RED }
          : { label: "Scanner listo", color: GRAY };
  return (
    <section className={`${glass} rounded-3xl ${compact ? "p-3" : "p-4 mb-5"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl grid place-items-center text-white shadow-lg"
          style={{ backgroundColor: stateMeta.color }}
        >
          <ScanLine className="w-6 h-6" />
        </div>
        <div className="mr-auto">
          <div className="text-sm font-black">{stateMeta.label}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Keyboard wedge · USB · Bluetooth · QR · DataMatrix · Code128
          </div>
        </div>
        <ScannerCapability
          icon={<Keyboard className="w-4 h-4" />}
          label="Wedge"
        />
        <ScannerCapability icon={<Usb className="w-4 h-4" />} label="USB" />
        <ScannerCapability
          icon={<BluetoothConnected className="w-4 h-4" />}
          label="BT"
        />
        <ScannerCapability icon={<QrCode className="w-4 h-4" />} label="2D" />
        <ScannerCapability
          icon={<Volume2 className="w-4 h-4" />}
          label="Beep"
        />
      </div>
      {lastScan && (
        <div
          className="mt-3 rounded-2xl border px-3 py-2 text-sm"
          style={{ borderColor: `${lastScan.valid ? GREEN : RED}66` }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-black">{lastScan.normalized}</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
              {lastScan.kind}
            </span>
            <span
              className={lastScan.valid ? "text-emerald-500" : "text-rose-500"}
            >
              {lastScan.message}
            </span>
          </div>
          {expected === "wo" && lastScan.valid && lastScan.kind !== "wo" && (
            <div className="mt-1 text-xs text-amber-500">
              Código válido, pero esta zona espera una WO.
            </div>
          )}
        </div>
      )}
      {!compact && history.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-gray-500 font-bold">
            <History className="w-3.5 h-3.5" /> Últimas lecturas
          </span>
          {history.map((item) => (
            <span
              key={`${item.at}-${item.raw}`}
              className={`rounded-full px-2 py-1 font-mono ${item.valid ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}
            >
              {item.normalized}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function ScannerCapability({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="min-h-9 px-3 rounded-2xl bg-white/10 flex items-center gap-1.5 text-xs font-black text-gray-600 dark:text-gray-200">
      {icon}
      {label}
    </span>
  );
}
