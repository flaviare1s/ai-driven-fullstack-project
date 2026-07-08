'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <h2>Algo deu errado ao carregar auth.</h2>
      <button type="button" onClick={() => reset()}>
        Tentar novamente
      </button>
    </div>
  );
}
