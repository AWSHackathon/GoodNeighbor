import { Logo } from "@/components/Logo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8">
        <Logo href="/" size={40} />
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
