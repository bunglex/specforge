import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocument, saveDocument } from '../api';
import { normalizeDocumentStructure } from '../editor/model';

export function useDocument(documentId?: string) {
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('Saved');
  const timerRef = useRef<number | null>(null);
  const latestDocRef = useRef<any>(null);

  useEffect(() => {
    latestDocRef.current = document;
  }, [document]);

  const saveNow = useCallback(async () => {
    if (!latestDocRef.current) return;

    setSaveState('Saving…');
    try {
      const saved = await saveDocument(latestDocRef.current);
      const normalized = normalizeDocumentStructure(saved).document;
      setDocument(normalized);
      setSaveState('Saved');
    } catch (saveError: any) {
      setSaveState(`Error: ${saveError.message || 'Failed to save document.'}`);
    }
  }, []);

  const saveDocumentDebounced = useCallback((options?: { immediate?: boolean }) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);

    if (options?.immediate) {
      void saveNow();
      return;
    }

    setSaveState('Saving…');
    timerRef.current = window.setTimeout(() => {
      void saveNow();
    }, 900);
  }, [saveNow]);

  useEffect(() => {
    let mounted = true;

    if (!documentId) {
      setLoading(false);
      setError('Document not found.');
      return;
    }

    void (async () => {
      setLoading(true);
      setError('');
      try {
        const raw = await getDocument(documentId);
        const normalized = normalizeDocumentStructure(raw).document;
        if (!mounted) return;
        setDocument(normalized);
      } catch (loadError: any) {
        if (!mounted) return;
        setError(loadError.message || 'Failed to load document.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [documentId]);

  return {
    document,
    setDocument,
    loading,
    error,
    saveState,
    saveDocumentDebounced
  };
}
