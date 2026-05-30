import type { CSSProperties, ReactNode } from "react";

export interface IconProps {
  size?: number;
  stroke?: number;
  fill?: string;
  className?: string;
  style?: CSSProperties;
}

interface IconBaseProps extends IconProps {
  d: string | ReactNode;
}

function Icon({ d, size = 16, stroke = 1.6, fill = "none", className, style }: IconBaseProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {typeof d === "string" ? <path d={d} /> : d}
    </svg>
  );
}

export const Icons = {
  Mic: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </>
      }
    />
  ),
  MicOff: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <line x1="2" y1="2" x2="22" y2="22" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
          <path d="M19 10v2a7 7 0 0 1-.11 1.23M5 10v2a7 7 0 0 0 12 5" />
        </>
      }
    />
  ),
  Stop: (p: IconProps) => (
    <Icon {...p} d={<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />} />
  ),
  Play: (p: IconProps) => <Icon {...p} d="M7 5l12 7-12 7V5z" fill="currentColor" stroke={0} />,
  Send: (p: IconProps) => <Icon {...p} d="M5 12l14-7-5 16-3-7-6-2z" />,
  Check: (p: IconProps) => <Icon {...p} d="M4 12l5 5L20 6" />,
  Plus: (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14" />,
  X: (p: IconProps) => <Icon {...p} d="M6 6l12 12M6 18L18 6" />,
  ChevronR: (p: IconProps) => <Icon {...p} d="M9 6l6 6-6 6" />,
  Arrow: (p: IconProps) => <Icon {...p} d="M5 12h14M13 6l6 6-6 6" />,
  Cog: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </>
      }
    />
  ),
  Bug: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="8" y="6" width="8" height="14" rx="4" />
          <path d="M12 6V4M9 4l-1-2M15 4l1-2M4 10l3 1M4 16l3-1M20 10l-3 1M20 16l-3-1" />
        </>
      }
    />
  ),
  Sparkles: (p: IconProps) => (
    <Icon
      {...p}
      d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14zM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14z"
    />
  ),
  Globe: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </>
      }
    />
  ),
  Image: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="M3 17l5-5 4 4 3-3 6 6" />
        </>
      }
    />
  ),
  Layers: (p: IconProps) => <Icon {...p} d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />,
  Bolt: (p: IconProps) => <Icon {...p} d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  Lock: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </>
      }
    />
  ),
  Crop: (p: IconProps) => <Icon {...p} d="M6 2v16h16M2 6h16v16" />,
  Edit: (p: IconProps) => <Icon {...p} d="M4 20h4l10-10-4-4L4 16v4zM13 6l4 4" />,
  Trash: (p: IconProps) => (
    <Icon {...p} d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
  ),
  Copy: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <rect x="8" y="8" width="13" height="13" rx="2" />
          <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </>
      }
    />
  ),
  Wave: (p: IconProps) => <Icon {...p} d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2" />,
  Crosshair: (p: IconProps) => (
    <Icon
      {...p}
      d={
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </>
      }
    />
  ),
};

const markPaths = (
  <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
    <line x1="9" y1="16" x2="9" y2="16" />
    <line x1="13" y1="12" x2="13" y2="20" />
    <line x1="17" y1="9" x2="17" y2="23" />
    <line x1="21" y1="13" x2="21" y2="19" />
    <line x1="25" y1="16" x2="25" y2="16" />
  </g>
);

export function SpeqifyLogo({ size = 22, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="0" y="0" width="32" height="32" rx="8" fill={mono ? "#1C1917" : "#4F46E5"} />
      {markPaths}
    </svg>
  );
}

export function SpeqifyWordmark({
  height = 22,
  color = "#1C1917",
  mark = "#4F46E5",
}: {
  height?: number;
  color?: string;
  mark?: string;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width={height} height={height} viewBox="0 0 32 32" fill="none">
        <rect x="0" y="0" width="32" height="32" rx="8" fill={mark} />
        {markPaths}
      </svg>
      <span
        style={{
          fontFamily: "var(--sp-font)",
          fontWeight: 650,
          fontSize: height * 0.82,
          letterSpacing: "-0.02em",
          color,
        }}
      >
        Speqify
      </span>
    </div>
  );
}

export const Trackers = {
  Jira: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M11.5 2 L21 11.5 L11.5 21 L2 11.5 Z" fill="#2684FF" />
      <path d="M11.5 7 L16 11.5 L11.5 16 L7 11.5 Z" fill="#fff" opacity="0.85" />
    </svg>
  ),
  GitHub: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1C1917">
      <path d="M12 2C6.5 2 2 6.6 2 12.3c0 4.5 2.9 8.4 6.9 9.7.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.4-3.4-1.4-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.5-1.1-4.5-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1 .8-.2 1.7-.3 2.5-.3.8 0 1.7.1 2.5.3 1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7.7.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.5 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5C19.1 20.7 22 16.8 22 12.3 22 6.6 17.5 2 12 2z" />
    </svg>
  ),
  Linear: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#5E6AD2">
      <path d="M2.2 14a10 10 0 0 0 7.8 7.8L2.2 14zM2 11.2 12.8 22A10 10 0 0 0 16 21.3L2.7 8A10 10 0 0 0 2 11.2zM3.6 6.2 17.8 20.4a10 10 0 0 0 2.6-2.6L6.2 3.6a10 10 0 0 0-2.6 2.6zM8 2.7l13.3 13.3A10 10 0 1 0 8 2.7z" />
    </svg>
  ),
  GitLab: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 21 8.5 10H15.5L12 21z" fill="#E24329" />
      <path d="M12 21 4 10H8.5L12 21z" fill="#FC6D26" />
      <path d="M12 21 2 10l1.3-4a.5.5 0 0 1 1 0L8.5 10 12 21z" fill="#FCA326" />
      <path d="M12 21 20 10h-4.5L12 21z" fill="#FC6D26" />
      <path d="M12 21 22 10l-1.3-4a.5.5 0 0 0-1 0L15.5 10 12 21z" fill="#FCA326" />
    </svg>
  ),
};

export type TrackerLogoName = keyof typeof Trackers;
