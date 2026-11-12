import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { Shell } from './components/layout/Shell';
import { ErrorState } from './components/ui/states';
import { Dashboard } from './features/dashboard/Dashboard';
import { FormsProvider } from './features/forms';
import { LoginPage } from './features/LoginPage';
import { useMe } from './lib/queries';
import { useRealtime } from './lib/realtime';

const TasksPage = lazy(() => import('./features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })));
const ShoppingPage = lazy(() => import('./features/shopping/ShoppingPage').then((m) => ({ default: m.ShoppingPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const PhotosPage = lazy(() => import('./features/photos/PhotosPage').then((m) => ({ default: m.PhotosPage })));
const PetsPage = lazy(() => import('./features/pets/PetsPage').then((m) => ({ default: m.PetsPage })));
const NotesPage = lazy(() => import('./features/notes/NotesPage').then((m) => ({ default: m.NotesPage })));
const CameraPage = lazy(() => import('./features/camera/CameraPage').then((m) => ({ default: m.CameraPage })));
const MusicPage = lazy(() => import('./features/music/MusicPage').then((m) => ({ default: m.MusicPage })));
const CalendarPage = lazy(() => import('./features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })));

function AnimatedRoutes() {
  const location = useLocation();
  return (
    // Transição entre telas: opacidade + leve deslocamento (240 ms)
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        className="min-h-full xl:h-full"
      >
        {/* Telas internas carregam sob demanda: o painel inicial abre mais rápido no PC antigo */}
        <Suspense fallback={null}>
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/agenda" element={<CalendarPage />} />
            <Route path="/tarefas" element={<TasksPage />} />
            <Route path="/compras" element={<ShoppingPage />} />
            <Route path="/recados" element={<NotesPage />} />
            <Route path="/pets" element={<PetsPage />} />
            <Route path="/camera" element={<CameraPage />} />
            <Route path="/fotos" element={<PhotosPage />} />
            <Route path="/musica" element={<MusicPage />} />
            <Route path="/ajustes" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  const me = useMe();
  const online = useRealtime(!!me.data);

  let content;
  if (me.isPending)
    content = (
      <div className="grid h-dvh place-items-center">
        <Loader2 className="size-8 animate-spin text-sage" />
      </div>
    );
  else if (me.isError)
    // API fora do ar (ex.: PC reiniciando): tenta de novo sem perder o painel
    content = (
      <div className="grid h-dvh place-items-center">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    );
  else if (!me.data) content = <LoginPage />;
  else
    content = (
      <BrowserRouter>
        <FormsProvider>
          <Shell online={online}>
            <AnimatedRoutes />
          </Shell>
        </FormsProvider>
      </BrowserRouter>
    );

  return (
    <>
      {content}
      <Toaster
        position="top-center"
        toastOptions={{
          classNames: {
            toast: '!rounded-2xl !border-line !bg-paper !text-ink !shadow-xl !font-sans',
            actionButton: '!bg-sage !text-white !rounded-lg !font-semibold',
            description: '!text-muted',
          },
        }}
      />
    </>
  );
}
