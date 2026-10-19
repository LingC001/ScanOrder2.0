import { useEffect, useState } from 'react';

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [resource, setResource] = useState<{ data: T | null; loading: boolean; error: string }>({
    data: null,
    loading: true,
    error: '',
  });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResource({ data, loading: false, error: '' });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResource({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : '加载失败',
          });
      });
    return () => controller.abort();
  }, [load, revision]);
  function retry() {
    setResource({ data: null, loading: true, error: '' });
    setRevision((value) => value + 1);
  }
  return { ...resource, retry };
}
