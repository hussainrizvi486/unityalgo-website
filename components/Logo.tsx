import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "h-12" }: { className?: string }) {
  return (
    <div className={className}>
      <Link href="/" className="flex items-center gap-1 md:gap-2">
        <Image
          src="/logo.png"
          alt="UnityAlgo"
          className="h-10 w-10 sm:h-12 sm:w-12"
          width='40'
          height='40'
        />
        <div className="font-bold text-base">UnityAlgo</div>
      </Link>
    </div>
  );
}
