import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { Graph, Overview, User } from "./types";

type State = {
  graph: Graph;
  overview: Overview;
  user: User;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
};
const Context = createContext<State | null>(null);
export function useData() {
  const context = useContext(Context);
  if (!context) throw new Error("Data context unavailable");
  return context;
}
export function DataProvider({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const [data, setData] = useState<{ graph: Graph; overview: Overview }>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [graph, overview] = await Promise.all([
        api<Graph>("/graph"),
        api<Overview>("/overview"),
      ]);
      setData({ graph, overview });
      setError("");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => void refresh().catch(() => {})}>重试</button>
        </div>
      )}
      {data ? (
        <Context.Provider value={{ ...data, user, refresh, notify: setToast }}>
          {children}
        </Context.Provider>
      ) : (
        !error && (
          <div className="loading">
            <span className="spinner" />
            正在连接知识网络…
          </div>
        )
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
