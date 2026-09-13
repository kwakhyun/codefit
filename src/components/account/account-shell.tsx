import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandIcon } from "../ui/brand-icon";
export function AccountShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="account-page" id="main-content">
      <header>
        <Link href="/" className="brand-logo">
          <BrandIcon />
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
