'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { glass } from '@/lib/glass';

interface ShelfProps {
  children: React.ReactNode;
  /** Ancho de cada tarjeta en el estante (desktop). */
  itemWidth?: number;
  ariaLabel?: string;
}

/**
 * Estante horizontal estilo App Store para desktop.
 * - Scroll con rueda/trackpad (WheelGesturesPlugin).
 * - Flechas prev/next que solo aparecen al hacer hover y solo si hay overflow.
 * - Navegable con flechas del teclado cuando el estante tiene foco.
 * - Si el contenido cabe sin desbordar, se ve como una fila normal (sin flechas).
 */
export function Shelf({ children, itemWidth = 200, ariaLabel }: ShelfProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { dragFree: true, align: 'start', containScroll: 'trimSnaps' },
    [WheelGesturesPlugin()],
  );

  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    // Diferir la medición inicial un frame: Embla necesita haber medido el
    // layout para reportar overflow, y así evitamos setState síncrono en el effect.
    const raf = requestAnimationFrame(sync);
    emblaApi.on('select', sync);
    emblaApi.on('reInit', sync);
    return () => {
      cancelAnimationFrame(raf);
      emblaApi.off('select', sync);
      emblaApi.off('reInit', sync);
    };
  }, [emblaApi, sync]);

  const hasOverflow = canPrev || canNext;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!emblaApi) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      emblaApi.scrollNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      emblaApi.scrollPrev();
    }
  };

  const slides = React.Children.toArray(children);

  return (
    <div className="group relative">
      <div
        className="overflow-hidden rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
        ref={emblaRef}
        tabIndex={0}
        role="group"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
      >
        <div className="flex gap-4 py-1">
          {slides.map((child, i) => (
            <div
              key={i}
              className="shrink-0 snap-start"
              style={{ width: itemWidth }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Flecha anterior */}
      {hasOverflow && (
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!canPrev}
          className={`${glass} absolute left-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Flecha siguiente */}
      {hasOverflow && (
        <button
          type="button"
          aria-label="Siguiente"
          onClick={() => emblaApi?.scrollNext()}
          disabled={!canNext}
          className={`${glass} absolute right-1 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-0`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
