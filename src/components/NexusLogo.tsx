"use client";
import * as React from "react";

type MarkProps = {
  size?: number; // px
  strokeWidth?: number; // svg stroke width
  gradient?: boolean; // use cyan→violet gradient stroke/fill
  className?: string;
  pulse?: boolean; // subtle pulse on the center node
};

export function NexusMark({
  size = 28,
  strokeWidth = 2.2,
  gradient = true,
  pulse = false,
  className = "",
}: MarkProps) {
  const gid = React.useId(); // unique gradient id per instance
  const stroke = gradient ? `url(#g-${gid})` : "currentColor";
  const fill = gradient ? `url(#g-${gid})` : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-label="Nexus mark"
      className={className}
    >
      {gradient && (
        <defs>
          <linearGradient id={`g-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#06b6d4" /> {/* cyan-500 */}
            <stop offset="100%" stopColor="#8b5cf6" /> {/* violet-500 */}
          </linearGradient>
        </defs>
      )}

      {/* N strokes */}
      <g
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 19V5" />
        <path d="M5 5L19 19" />
        <path d="M19 19V5" />
      </g>

      {/* Nodes */}
      <g>
        <circle cx="5" cy="5" r="1.8" fill={fill} />
        <circle cx="5" cy="19" r="1.8" fill={fill} />
        <circle cx="19" cy="5" r="1.8" fill={fill} />
        <circle cx="19" cy="19" r="1.8" fill={fill} />
        <circle
          cx="12"
          cy="12"
          r="2"
          fill={fill}
          className={pulse ? "animate-pulse" : undefined}
        />
      </g>
    </svg>
  );
}

type LogoProps = MarkProps & {
  wordmark?: boolean; // show “Nexus” text
  textSize?: string; // Tailwind text size class, e.g. "text-xl"
  compact?: boolean; // tighter spacing
};

export function NexusLogo({
  wordmark = true,
  textSize = "text-xl",
  compact = false,
  ...markProps
}: LogoProps) {
  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <NexusMark {...markProps} />
      {wordmark && (
        <span
          className={`${textSize} font-bold tracking-tight bg-gradient-to-r from-cyan-500 to-violet-500 text-transparent bg-clip-text`}
          aria-label="Nexus"
        >
          Nexus
        </span>
      )}
    </div>
  );
}
