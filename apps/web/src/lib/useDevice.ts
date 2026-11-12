import { useSyncExternalStore } from 'react';

// "panel" = monitor da casa (tela larga, layout Bento sem rolagem); "mobile" = celular.
// Igual ao variant "xl" de styles.css: só celular fica com o layout mobile
const query = '(min-width: 900px) and (min-height: 500px)';

const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export function useDevice(): 'panel' | 'mobile' {
  return useSyncExternalStore(subscribe, () => (window.matchMedia(query).matches ? 'panel' : 'mobile'));
}

export const useIsDesktop = () => useDevice() === 'panel';
