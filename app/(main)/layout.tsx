import Link from "next/link";
import { UserMenu } from "@/components/auth/UserMenu";
import { Logo } from "@/components/Logo";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <Logo href="/map" size={36} />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/map" className="font-medium text-slate-700 hover:text-teal-600">
            Map
          </Link>
          <UserMenu />
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
