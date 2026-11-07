import React from 'react';
import { BedIrrigationType } from '../types/garden';
import { PipeCellConnections } from '../utils/companionChecker';

interface CageOverlayProps {
  compact?: boolean;
}

/**
 * Renders a top-down / isometric wire Tomato/Plant Cage overlay right on top of a plant tile.
 */
export const CageOverlay: React.FC<CageOverlayProps> = ({ compact = false }) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center z-20"
      title="Plant Support Cage"
    >
      <svg
        viewBox="0 0 64 64"
        className="w-full h-full p-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
      >
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={compact ? '2.5' : '2'}
          strokeDasharray={compact ? 'none' : '5 2'}
          opacity="0.9"
        />
        {!compact && (
          <circle
            cx="32"
            cy="32"
            r="18"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
            opacity="0.75"
          />
        )}
        <line
          x1="32"
          y1="4"
          x2="32"
          y2="14"
          stroke="#f8fafc"
          strokeWidth="2"
          opacity="0.85"
        />
        <line
          x1="32"
          y1="50"
          x2="32"
          y2="60"
          stroke="#f8fafc"
          strokeWidth="2"
          opacity="0.85"
        />
        <line
          x1="4"
          y1="32"
          x2="14"
          y2="32"
          stroke="#f8fafc"
          strokeWidth="2"
          opacity="0.85"
        />
        <line
          x1="50"
          y1="32"
          x2="60"
          y2="32"
          stroke="#f8fafc"
          strokeWidth="2"
          opacity="0.85"
        />
      </svg>
      {!compact && (
        <span className="absolute bottom-5 right-1 bg-slate-800/90 text-slate-100 border border-slate-400/70 text-[8px] font-mono font-bold px-1 py-0 rounded shadow-2xs leading-tight">
          CAGE
        </span>
      )}
    </div>
  );
};

interface ArchOverlayBadgeProps {
  compact?: boolean;
}

/**
 * Renders an overhead Tomato Arch / Cattle Panel wire mesh indicator on arch-edge tiles.
 */
export const ArchCellOverlay: React.FC<ArchOverlayBadgeProps> = ({ compact = false }) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-15 overflow-hidden rounded-xl"
      title="Under Tomato / Cattle Panel Arch Trellis"
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-slate-300 via-white to-slate-300 opacity-75" />
      {!compact && (
        <span className="absolute top-1 left-1/2 -translate-x-1/2 bg-cyan-900/90 text-cyan-100 border border-cyan-400/60 text-[8px] font-mono font-bold px-1 rounded shadow-2xs leading-tight">
          ARCH
        </span>
      )}
    </div>
  );
};

interface DripCellOverlayProps {
  mode?: BedIrrigationType;
  connections?: PipeCellConnections;
  compact?: boolean;
}

/**
 * Renders a Drip Irrigation tubing line + water emitter droplet overlay on a garden bed square.
 * When `connections` is provided, draws auto-connected pipe segments (straight, 90° elbow, T-fitting).
 */
export const DripCellOverlay: React.FC<DripCellOverlayProps> = ({
  mode = 'drip_lines',
  connections,
  compact = false,
}) => {
  const strokeW = compact ? 7 : 5.5;
  const innerW = compact ? 3.5 : 2.5;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-15 overflow-hidden"
      title="Drip Irrigation Line & Emitter (1 ft)"
    >
      <svg viewBox="0 0 64 64" className="w-full h-full">
        {connections ? (
          <>
            {/* Dark pipe outer casing */}
            {connections.up && (
              <line
                x1="32"
                y1="0"
                x2="32"
                y2="32"
                stroke="#0c4a6e"
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            )}
            {connections.down && (
              <line
                x1="32"
                y1="32"
                x2="32"
                y2="64"
                stroke="#0c4a6e"
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            )}
            {connections.left && (
              <line
                x1="0"
                y1="32"
                x2="32"
                y2="32"
                stroke="#0c4a6e"
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            )}
            {connections.right && (
              <line
                x1="32"
                y1="32"
                x2="64"
                y2="32"
                stroke="#0c4a6e"
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            )}

            {/* Inner blue water core */}
            {connections.up && (
              <line
                x1="32"
                y1="0"
                x2="32"
                y2="32"
                stroke="#38bdf8"
                strokeWidth={innerW}
                strokeLinecap="round"
              />
            )}
            {connections.down && (
              <line
                x1="32"
                y1="32"
                x2="32"
                y2="64"
                stroke="#38bdf8"
                strokeWidth={innerW}
                strokeLinecap="round"
              />
            )}
            {connections.left && (
              <line
                x1="0"
                y1="32"
                x2="32"
                y2="32"
                stroke="#38bdf8"
                strokeWidth={innerW}
                strokeLinecap="round"
              />
            )}
            {connections.right && (
              <line
                x1="32"
                y1="32"
                x2="64"
                y2="32"
                stroke="#38bdf8"
                strokeWidth={innerW}
                strokeLinecap="round"
              />
            )}

            {/* Center Fitting / Emitter Node */}
            <circle
              cx="32"
              cy="32"
              r={
                connections.fitting === 'elbow' ||
                connections.fitting === 'tee' ||
                connections.fitting === 'cross'
                  ? 6
                  : 4.5
              }
              fill="#0284c7"
              stroke="#e0f2fe"
              strokeWidth="1.5"
            />
          </>
        ) : mode === 'soaker_hose' ? (
          <path
            d="M 32 0 C 48 16, 16 48, 32 64"
            fill="none"
            stroke="#38bdf8"
            strokeWidth={compact ? '3.5' : '3'}
            strokeDasharray="3 2"
            opacity="0.85"
          />
        ) : mode === 'micro_sprayers' ? (
          <>
            <line
              x1="0"
              y1="32"
              x2="64"
              y2="32"
              stroke="#0284c7"
              strokeWidth="2"
              opacity="0.7"
            />
            <circle
              cx="32"
              cy="32"
              r="14"
              fill="rgba(56, 189, 248, 0.18)"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          </>
        ) : (
          <>
            <line
              x1="20"
              y1="0"
              x2="20"
              y2="64"
              stroke="#0284c7"
              strokeWidth={compact ? '3' : '2.5'}
              opacity="0.85"
            />
            <line
              x1="44"
              y1="0"
              x2="44"
              y2="64"
              stroke="#0284c7"
              strokeWidth={compact ? '3' : '2.5'}
              opacity="0.85"
            />
            <circle cx="20" cy="22" r="3" fill="#38bdf8" />
            <circle cx="44" cy="42" r="3" fill="#38bdf8" />
          </>
        )}
      </svg>
      {!compact && (
        <span className="absolute bottom-5 left-1 bg-sky-700/90 text-sky-50 border border-sky-300/60 text-[8px] font-mono font-bold px-1 py-0 rounded shadow-2xs leading-tight">
          💧
        </span>
      )}
    </div>
  );
};
