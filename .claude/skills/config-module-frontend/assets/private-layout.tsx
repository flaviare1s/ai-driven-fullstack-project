import { redirect } from 'next/navigation';

// TODO: substituir por uma checagem real de sessão/autenticação (ex.: usando
// o módulo "@.../auth" já existente no monorepo) antes de ir para produção.
function isAuthenticated(): boolean {
  return false;
}

export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isAuthenticated()) {
    redirect('/login');
  }

  return <>{children}</>;
}
