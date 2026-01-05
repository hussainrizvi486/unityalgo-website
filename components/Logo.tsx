import Image from "next/image";
import Link from "next/link";

export function Logo({ className = "h-12" }: { className?: string }) {
  return (
    <div className={className}>
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/logo.svg"
          alt="UnityAlgo"
          className="h-10 w-10 sm:h-12 sm:w-12"
          width='40'
          height='40'
        />
        <div className="font-bold  sm:text-2xl">UnityAlgo</div>
      </Link>
    </div>
  );
}
