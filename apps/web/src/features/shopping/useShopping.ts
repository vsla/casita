import type { ShoppingItem } from '@home-hub/shared';
import { api } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';

export function useToggleShopping() {
  return useApiMutation((i: ShoppingItem) => api(`/shopping/${i.id}`, { method: 'PATCH', body: { checked: !i.checked } }), {
    invalidate: [['shopping']],
    optimistic: {
      key: ['shopping'],
      update: (rows: ShoppingItem[], i) => rows.map((r) => (r.id === i.id ? { ...r, checked: !i.checked } : r)),
    },
  });
}
