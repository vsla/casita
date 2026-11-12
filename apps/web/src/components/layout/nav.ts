import { CalendarDays, Camera, CircleCheck, House, Image, MessageSquare, Music2, PawPrint, Settings, ShoppingCart, type LucideIcon } from 'lucide-react';

export type NavItem = { to: string; label: string; icon: LucideIcon };

export const NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: House },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/tarefas', label: 'Tarefas', icon: CircleCheck },
  { to: '/compras', label: 'Compras', icon: ShoppingCart },
  { to: '/recados', label: 'Recados', icon: MessageSquare },
  { to: '/pets', label: 'Pets', icon: PawPrint },
  { to: '/camera', label: 'Câmera', icon: Camera },
  { to: '/fotos', label: 'Fotos', icon: Image },
  { to: '/musica', label: 'Música', icon: Music2 },
];

export const SETTINGS_NAV: NavItem = { to: '/ajustes', label: 'Ajustes', icon: Settings };

/** No celular: 4 abas fixas + "Mais" */
export const MOBILE_TABS = ['/', '/agenda', '/tarefas', '/compras'];
