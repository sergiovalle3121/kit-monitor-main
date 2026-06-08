'use client';

import { createContext, useContext } from 'react';

/**
 * Chasis del marco de Office. El `OfficeShell` publica un nodo anfitrión
 * (`ribbonHost`) justo debajo del header; cada editor renderiza su propio
 * ribbon con un portal hacia ese nodo. Así el estado del editor (TipTap,
 * Fabric, Fortune-Sheet) vive local en el editor y el ribbon aparece, visual
 * y semánticamente, dentro del shell — debajo del header y fuera del lienzo
 * desplazable.
 */
export interface OfficeChrome {
  /** Nodo del shell donde el editor debe portar su ribbon (o null si aún no montó). */
  ribbonHost: HTMLElement | null;
}

const OfficeChromeContext = createContext<OfficeChrome>({ ribbonHost: null });

export const OfficeChromeProvider = OfficeChromeContext.Provider;

export function useOfficeChrome(): OfficeChrome {
  return useContext(OfficeChromeContext);
}
