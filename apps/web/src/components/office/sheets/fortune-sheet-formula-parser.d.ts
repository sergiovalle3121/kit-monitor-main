// El paquete @fortune-sheet/formula-parser (el motor de fórmulas que usa la
// rejilla de Fortune-Sheet) no publica tipos. Lo usamos sólo en los specs de
// hojas (ejecutados con `npx tsx`) para evaluar fórmulas con el motor real.
// Declaración mínima para que `tsc`/`next build` no fallen por TS7016.
declare module '@fortune-sheet/formula-parser';
