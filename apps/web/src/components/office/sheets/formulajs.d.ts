// El paquete @formulajs/formulajs (la librería de funciones que el motor de
// Fortune-Sheet usa como fallback) no publica tipos. Lo importamos directamente
// en `statFunctions.ts` para delegar los nombres modernos (con punto) en sus
// equivalentes legados verificados. Declaración mínima para que `tsc`/`next build`
// no fallen por TS7016 (módulo sin declaración de tipos → `any`).
declare module '@formulajs/formulajs';
