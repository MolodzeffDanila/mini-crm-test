import type { ReactNode } from 'react';
import { Brand } from './Brand';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="setup">
      <Brand />
      {children}
    </main>
  );
}
