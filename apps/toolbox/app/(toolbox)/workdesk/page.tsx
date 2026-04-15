import { NotificationPanel } from "./components/notification-panel";

export default function WorkdeskPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <NotificationPanel />
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-xl font-semibold text-slate-900">Workdesk</h1>
        <p className="mt-2 text-sm text-slate-500">
          Transaction data grid — coming soon.
        </p>
      </div>
    </div>
  );
}
