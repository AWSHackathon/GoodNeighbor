import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  size?: number;
  showText?: boolean;
  href?: string;
};

export function Logo({ size = 48, showText = true, href }: LogoProps) {
  const content = (
    <div className="flex items-center gap-3">
      <Image
        src="/logo.svg"
        alt="Good Neighbor"
        width={size}
        height={size}
        priority
      />
      {showText && (
        <span className="text-xl font-semibold tracking-tight text-slate-900">
          Good Neighbor
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
