import type { SVGProps } from "react";

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z" />
    </svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" {...props}>
      <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6" />
      <path d="M10 10v7M14 10v7" />
    </svg>
  );
}
