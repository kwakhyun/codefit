import { SiteHeader } from "@/components/navigation/site-header";

export function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="account-page" id="main-content">
      <SiteHeader />
      {children}
    </main>
  );
}
