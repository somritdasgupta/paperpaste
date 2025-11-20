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
  deletionEnabled: boolean;
  bottomSheet: {
    isOpen: boolean;
    view: "devices" | "qr" | "verification" | "delete-item" | "leave-session" | "kill-session" | null;
    data?: any;
  };
  
  setConnectionStatus: (status: "connecting" | "connected" | "disconnected") => void;
  setItemsCount: (count: number) => void;
  setExportEnabled: (enabled: boolean) => void;
  setCanExport: (can: boolean) => void;
  setIsHost: (isHost: boolean) => void;
  setAutoRefreshEnabled: (enabled: boolean) => void;
  setIsRefreshing: (refreshing: boolean) => void;
  setAutoRefreshInterval: (interval: number) => void;
  setDeletionEnabled: (enabled: boolean) => void;
  
  toggleAutoRefresh: () => void;
  handleManualRefresh: () => void;
  cycleTimeInterval: () => void;
  
  openBottomSheet: (view: HistoryControlsContextType["bottomSheet"]["view"], data?: any) => void;
  closeBottomSheet: () => void;
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
  const [deletionEnabled, setDeletionEnabled] = useState(true);

  // Bottom Sheet State
  const [bottomSheet, setBottomSheet] = useState<HistoryControlsContextType["bottomSheet"]>({
    isOpen: false,
    view: null,
    data: null,
  });

  const openBottomSheet = (view: HistoryControlsContextType["bottomSheet"]["view"], data?: any) => {
    setBottomSheet({ isOpen: true, view, data });
  };

  const closeBottomSheet = () => {
    setBottomSheet((prev) => ({ ...prev, isOpen: false }));
    // Delay clearing view/data to allow animation to finish
    setTimeout(() => {
      setBottomSheet({ isOpen: false, view: null, data: null });
    }, 300);
  };

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
        deletionEnabled,
        bottomSheet,
        
        setConnectionStatus,
        setItemsCount,
        setExportEnabled,
        setCanExport,
        setIsHost,
        setAutoRefreshEnabled,
        setIsRefreshing,
        setAutoRefreshInterval,
        setDeletionEnabled,
        
        toggleAutoRefresh,
        handleManualRefresh,
        cycleTimeInterval,
        
        openBottomSheet,
        closeBottomSheet,
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
