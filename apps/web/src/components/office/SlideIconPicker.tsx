'use client';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Shapes, Check, Star, Heart, ThumbsUp, Flag, Bell, Lightbulb, Rocket, Target, TrendingUp,
  ShieldCheck, Zap, Award, Clock, Mail, Phone, MapPin, Users, Settings, Cloud, Globe, Lock, Smile,
  type LucideIcon,
} from 'lucide-react';
import { RibbonMenuButton } from './ribbon';

const ICONS: LucideIcon[] = [
  Check, Star, Heart, ThumbsUp, Flag, Bell, Lightbulb, Rocket, Target, TrendingUp, ShieldCheck, Zap,
  Award, Clock, Mail, Phone, MapPin, Users, Settings, Cloud, Globe, Lock, Smile,
];

/** Biblioteca de iconos (lucide) que se insertan como SVG vectorial en el lienzo. */
export function SlideIconPicker({ onPick }: { onPick: (svg: string) => void }) {
  const pick = (Icon: LucideIcon) => {
    const svg = renderToStaticMarkup(
      <Icon width={96} height={96} stroke="#111827" strokeWidth={1.75} fill="none" />,
    );
    onPick(svg);
  };
  return (
    <RibbonMenuButton icon={Shapes} label="Iconos" menuWidth={272}>
      <div className="grid grid-cols-6 gap-1">
        {ICONS.map((Icon, i) => (
          <button
            key={i} type="button" title="Insertar icono"
            onMouseDown={(e) => e.preventDefault()} onClick={() => pick(Icon)}
            className="h-9 inline-flex items-center justify-center rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/10 text-gray-700 dark:text-gray-200"
          >
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </button>
        ))}
      </div>
    </RibbonMenuButton>
  );
}
