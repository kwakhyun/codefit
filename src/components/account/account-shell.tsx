export function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="account-page" id="main-content" tabIndex={-1}>
      {children}
    </main>
  );
}
