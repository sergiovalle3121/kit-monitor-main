import { redirect } from "next/navigation";

/**
 * La suite real de documentos vive en /dashboard/office (módulo `office`, ya
 * cableado a `/office-documents`: docs, hojas, slides, versiones y papelera).
 *
 * Esta ruta antes renderizaba un listado de ejemplo hardcodeado (datos falsos),
 * un cabo suelto que duplicaba a Office. Ahora redirige a la pantalla real para
 * que cualquier URL/bookmark viejo siga llevando a un lugar funcional.
 */
export default function DocumentsPage() {
  redirect("/dashboard/office");
}
