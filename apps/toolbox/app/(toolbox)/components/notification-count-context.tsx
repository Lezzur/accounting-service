"use client";

import { createContext, useContext, useState, useCallback } from "react";

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotificationCountContextType {
  unprocessedCount: number;
  setUnprocessedCount: (count: number) => void;
}

const NotificationCountContext = createContext<NotificationCountContextType>({
  unprocessedCount: 0,
  setUnprocessedCount: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unprocessedCount, setCount] = useState(0);
  const setUnprocessedCount = useCallback((n: number) => setCount(n), []);

  return (
    <NotificationCountContext.Provider
      value={{ unprocessedCount, setUnprocessedCount }}
    >
      {children}
    </NotificationCountContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotificationCount() {
  return useContext(NotificationCountContext);
}
