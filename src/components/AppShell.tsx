import { ReactNode } from 'react';

type AppShellProps = {
  header?: ReactNode;
  children: ReactNode;
};

export default function AppShell({ header, children }: AppShellProps) {
  return (
    <main className="shell">
      {header}
      {children}
    </main>
  );
}
