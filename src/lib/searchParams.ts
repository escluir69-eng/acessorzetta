/**
 * Compatibilidade com o useSearchParams do react-router-dom sobre o
 * TanStack Router: retorna [URLSearchParams, setter].
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

type SetSearchParams = (
  next: URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams),
  options?: { replace?: boolean },
) => void;

export function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);

  const setSearchParams = useCallback<SetSearchParams>(
    (next, options) => {
      const resolved =
        typeof next === "function"
          ? next(new URLSearchParams(searchStr))
          : next instanceof URLSearchParams
            ? next
            : new URLSearchParams(next);
      const qs = resolved.toString();
      void navigate({
        to: `${pathname}${qs ? `?${qs}` : ""}`,
        replace: options?.replace ?? false,
      });
    },
    [navigate, pathname, searchStr],
  );

  return [searchParams, setSearchParams];
}
