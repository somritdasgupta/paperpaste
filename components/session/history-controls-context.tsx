"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type HistoryControlsContextType = {
  connectionStatus: "connecting" | "connected" | "disconnected";
  itemsCount: number;
  exportEnabled: boolean;
  canExport: boolean;
  isHost: boolean;
  sessionCode: string;
  autoRefreshEnabled: boolean;
  isRefreshing: boolean;
  autoRefreshInterval: number;
  setConnectionStatus: (
    status: "connecting" | "connected" | "disconnected"
  ) => void;
  setItemsCount: (count: number) => void;
  setExportEnabled: (enabled: boolean) => void;
  setCanExport: (can: boolean) => void;
  setIsHost: (isHost: boolean) => void;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  setIsRefreshing: (refreshing: boolean) => void;
  setAutoRefreshInterval: (interval: number) => void;
  toggleAutoRefresh: () => void;
  handleManualRefresh: () => void;
  cycleTimeInterval: () => void;
};

const HistoryControlsContext = createContext<HistoryControlsContextType | null>(
  null
);

export function HistoryControlsProvider({
  children,
  sessionCode,
}: {
  children: ReactNode;
  sessionCode: string;
}) {
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [itemsCount, setItemsCount] = useState(0);
  const [exportEnabled, setExportEnabled] = useState(true);
  const [canExport, setCanExport] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5000);

  const toggleAutoRefresh = () => {
    // Dispatch event to ItemsList to toggle its local state
    window.dispatchEvent(new CustomEvent("toggle-auto-refresh"));
  };

  const cycleTimeInterval = () => {
    // Dispatch event to ItemsList to cycle its local state
    window.dispatchEvent(new CustomEvent("cycle-time-interval"));
  };

  const handleManualRefresh = () => {
    // Dispatch event to ItemsList to trigger refresh
    window.dispatchEvent(new CustomEvent("manual-refresh"));
  };

  return (
    <HistoryControlsContext.Provider
      value={{
        connectionStatus,
        itemsCount,
        exportEnabled,
        canExport,
        isHost,
        sessionCode,
        autoRefreshEnabled,
        isRefreshing,
        autoRefreshInterval,
        setConnectionStatus,
        setItemsCount,
        setExportEnabled,
        setCanExport,
        setIsHost,
        setAutoRefreshEnabled,
        setIsRefreshing,
        setAutoRefreshInterval,
        toggleAutoRefresh,
        handleManualRefresh,
        cycleTimeInterval,
      }}
    >
      {children}
    </HistoryControlsContext.Provider>
  );
}

export function useHistoryControls() {
  const context = useContext(HistoryControlsContext);
  if (!context) {
    throw new Error(
      "useHistoryControls must be used within HistoryControlsProvider"
    );
  }
  return context;
}
