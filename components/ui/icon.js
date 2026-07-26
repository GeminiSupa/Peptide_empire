import {
  Activity,
  BadgeDollarSign,
  Bandage,
  Brain,
  Briefcase,
  Dumbbell,
  Flame,
  Headset,
  HeartPulse,
  Leaf,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react';

// Content files reference icons by name so the copy stays free of imports.
const ICONS = {
  Activity,
  BadgeDollarSign,
  Bandage,
  Brain,
  Briefcase,
  Dumbbell,
  Flame,
  Headset,
  HeartPulse,
  Leaf,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
};

export default function Icon({ name, className = 'h-6 w-6' }) {
  const Cmp = ICONS[name] || Sparkles;
  return <Cmp className={className} aria-hidden="true" />;
}
