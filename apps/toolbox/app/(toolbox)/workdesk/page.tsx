import { NotificationPanel } from "./components/notification-panel";
import { TransactionGrid } from "./components/transaction-grid";

export default function WorkdeskPage() {
  return (
    <div className="flex h-full overflow-hidden">
      <NotificationPanel />
      <div className="flex-1 overflow-hidden">
        <TransactionGrid />
      </div>
    </div>
  );
}
