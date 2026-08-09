import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode
} from "react";

type NavigateOptions = { replace?: boolean; scroll?: boolean; bypassBlocker?: boolean };
type RouterValue = {
  pathname: string;
  search: string;
  hash: string;
  navigate(to: string, options?: NavigateOptions): void;
  registerNavigationBlocker(message: string): () => void;
};

const RouterContext = createContext<RouterValue | null>(null);

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(readLocation);
  const locationRef = useRef(location);
  const blockers = useRef(new Map<symbol, string>());

  const activeBlocker = useCallback(() => {
    const messages = [...blockers.current.values()];
    return messages.at(-1) ?? null;
  }, []);

  const registerNavigationBlocker = useCallback((message: string) => {
    const token = Symbol("navigation-blocker");
    blockers.current.set(token, message);
    return () => {
      blockers.current.delete(token);
    };
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const next = readLocation();
      if (!confirmBlockedNavigation(activeBlocker(), (message) => window.confirm(message))) {
        window.history.pushState(null, "", locationHref(locationRef.current));
        return;
      }
      locationRef.current = next;
      setLocation(next);
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeBlocker()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [activeBlocker]);

  const navigate = useCallback((to: string, options: NavigateOptions = {}) => {
    const target = resolveInternalNavigation(to, window.location.href);
    if (target && isCurrentInternalNavigation(target, window.location.href)) {
      if (options.scroll !== false) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    if (!options.bypassBlocker
      && !confirmBlockedNavigation(activeBlocker(), (message) => window.confirm(message))) return;
    if (!target) {
      window.location.assign(to);
      return;
    }
    const method = options.replace ? "replaceState" : "pushState";
    window.history[method](null, "", target);
    const next = readLocation();
    locationRef.current = next;
    setLocation(next);
    if (options.scroll !== false) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeBlocker]);

  const value = useMemo<RouterValue>(() => ({
    ...location,
    navigate,
    registerNavigationBlocker
  }), [location, navigate, registerNavigationBlocker]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error("useRouter must be used inside BrowserRouter");
  return value;
}

export function useNavigationBlocker(
  active: boolean,
  message = "You have unsaved curation changes. Leave without saving?"
): void {
  const { registerNavigationBlocker } = useRouter();
  useEffect(() => {
    if (!active) return;
    return registerNavigationBlocker(message);
  }, [active, message, registerNavigationBlocker]);
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  scroll?: boolean;
};

export function Link({ to, replace, scroll, onClick, target, download, ...props }: LinkProps) {
  const { navigate } = useRouter();
  return (
    <a
      {...props}
      href={to}
      target={target}
      download={download}
      onClick={(event) => {
        onClick?.(event);
        if (!shouldInterceptLink(event, { target, download: Boolean(download) })) return;
        if (!resolveInternalNavigation(to, window.location.href)) return;
        event.preventDefault();
        navigate(to, { replace, scroll });
      }}
    />
  );
}

export function resolveInternalNavigation(to: string, base: string): string | null {
  try {
    const baseUrl = new URL(base);
    const target = new URL(to, baseUrl);
    if (target.origin !== baseUrl.origin) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function isCurrentInternalNavigation(target: string, currentHref: string): boolean {
  try {
    const current = new URL(currentHref);
    return target === `${current.pathname}${current.search}${current.hash}`;
  } catch {
    return false;
  }
}

export function shouldInterceptLink(
  event: Pick<MouseEvent<HTMLAnchorElement>, "button" | "defaultPrevented" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
  options: { target?: string; download: boolean }
): boolean {
  return !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && !options.download
    && (!options.target || options.target === "_self");
}

export function confirmBlockedNavigation(
  message: string | null,
  confirm: (message: string) => boolean
): boolean {
  return message === null || confirm(message);
}

function readLocation() {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash
  };
}

function locationHref(location: ReturnType<typeof readLocation>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}
