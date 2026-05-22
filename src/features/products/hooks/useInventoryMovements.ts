import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { InventoryMovement } from '../types';

export interface InventoryMovementsResult {
  movements: InventoryMovement[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export const useInventoryMovements = (limit = 8): InventoryMovementsResult => {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.inventory.getMovements({ limit });
      setMovements(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[useInventoryMovements] failed to fetch movements', error);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { movements, loading, refresh };
};
