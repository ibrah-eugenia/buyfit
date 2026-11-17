import Link from "next/link";
import { Logo, SLOGAN } from "@/components/brand/logo";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-linen px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 block text-center text-[32px]">
          <Logo />
        </Link>
        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(17,17,17,0.04)] ring-1 ring-line sm:p-8">
          <h1 className="text-[26px] font-bold tracking-[-0.03em]">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-grey">{description}</p>
          {children}
        </div>
        <div className="mt-6 text-center text-sm text-grey">{footer}</div>
        <p className="mt-8 text-center text-caption text-grey italic">{SLOGAN}</p>
      </div>
    </main>
  );
}
