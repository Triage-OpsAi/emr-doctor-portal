import Image from "next/image";
import triageLogo from "@/components/image/triage-logo.jpeg";

export function TriCareLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-xl bg-white ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src={triageLogo}
        alt=""
        fill
        sizes={`${size}px`}
        className="scale-[1.55] object-cover"
        priority
      />
    </span>
  );
}
