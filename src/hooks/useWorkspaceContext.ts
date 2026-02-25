import { useCallback, useEffect, useState } from 'react';
import { loadWorkspaceContext } from '../api';

interface WorkspaceContext {
  workspaceMembers: any[];
  workspaces: any[];
  documents: any[];
  clauses: any[];
  tags: any[];
  taxonomy: any[];
  modules: any[];
}

const emptyContext: WorkspaceContext = {
  workspaceMembers: [],
  workspaces: [],
  documents: [],
  clauses: [],
  tags: [],
  taxonomy: [],
  modules: []
};

export function useWorkspaceContext(session: any) {
  const [context, setContext] = useState<WorkspaceContext>(emptyContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!session) {
      setContext(emptyContext);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await loadWorkspaceContext();
      setContext(data as WorkspaceContext);
    } catch (contextError: any) {
      setError(contextError.message || 'Failed to load workspace context.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { context, loading, error, refresh };
}
