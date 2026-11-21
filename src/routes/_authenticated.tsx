import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useOrion } from "@/store/orionContext";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] text-[#0c1928] dark:bg-[#08121d] dark:text-slate-100">
      <div className="text-center">
        <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[#173d4a] border-t-transparent" />
        <p className="mt-3 text-xs font-medium text-[#52616a] dark:text-slate-400">
          Verificando sessão segura...
        </p>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: ReactNode }) {
  const { authReady, user } = useOrion();
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [authReady, user, navigate]);

  if (!authReady) return <AuthSplash />;
  if (!user) return <AuthSplash />;
  return <>{children}</>;
}

function AuthenticatedLayout() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  );
}
