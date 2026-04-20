import { SkipToContent } from "@numera/ui";
import { Sidebar, BottomTabBar } from "./components/sidebar";
import { NotificationCountProvider } from "./components/notification-count-context";

export const dynamic = "force-dynamic";

export default function ToolboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationCountProvider>
      <SkipToContent />
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-auto bg-[var(--background)] focus:outline-none pb-[44px] md:pb-0"
        >
          {children}
        </main>
      </div>
      <BottomTabBar />
    </NotificationCountProvider>
  );
}
