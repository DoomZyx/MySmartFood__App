import { Outlet } from "react-router-dom";
import AppLayout from "../dashboard/Components/Layout/AppLayout";

export function DashboardShell() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
