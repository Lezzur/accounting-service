"use client";

import { useState, useCallback } from "react";
import { NotificationPanel } from "./components/notification-panel";
import { TransactionGrid } from "./components/transaction-grid";
import { DocPreviewPanel } from "./components/doc-preview-panel";
import { cn } from "@numera/ui";

export default function WorkdeskPage() {
  const [previewNotifId, setPreviewNotifId] = useState<string | null>(null);

  const handleDocPreview = useCallback((notificationId: string) => {
    setPreviewNotifId(notificationId);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewNotifId(null);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      {/*
        Notification panel shares the right-side rail with doc preview.
        Hidden (but kept mounted to preserve scroll/state) when doc preview
        is active — showing both simultaneously at 1280px leaves the grid
        too narrow for an 8-column spreadsheet.
      */}
      <div className={cn(previewNotifId ? "hidden" : "contents")}>
        <NotificationPanel />
      </div>

      {/* Transaction grid — always flex-1 */}
      <div className="flex-1 overflow-hidden min-w-0">
        <TransactionGrid onDocPreview={handleDocPreview} />
      </div>

      {/* Document preview panel — slides in from right */}
      <DocPreviewPanel
        open={!!previewNotifId}
        notificationId={previewNotifId}
        onClose={handleClosePreview}
      />
    </div>
  );
}
