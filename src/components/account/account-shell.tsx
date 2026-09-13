import Link from "next/link";
import { ArrowLeft, Terminal } from "lucide-react";
export function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="account-page" id="main-content">
      <header>
        <Link href="/" className="brand-logo">
          <Terminal size={23} />
          CODE:FIT_
        </Link>
        <Link href="/" className="text-button">
          <ArrowLeft size={15} />
          문제 보관함
        </Link>
      </header>
      {children}
    </main>
  );
}
