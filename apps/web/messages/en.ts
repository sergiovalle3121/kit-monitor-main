/**
 * Catálogo de mensajes en inglés (idioma por defecto).
 *
 * Cada namespace es un JSON independiente para que la migración por zonas sea
 * limpia y revisable (un commit = una zona). Añadir un namespace = crear el
 * JSON + una línea de import aquí y en `es.ts`.
 */
import common from "./en/common.json";
import language from "./en/language.json";
import glossary from "./en/glossary.json";
import nav from "./en/nav.json";
import landing from "./en/landing.json";
import auth from "./en/auth.json";
import selectWorkspace from "./en/selectWorkspace.json";
import dashboard from "./en/dashboard.json";

const en = {
  common,
  language,
  glossary,
  nav,
  landing,
  auth,
  selectWorkspace,
  dashboard,
};

export default en;
