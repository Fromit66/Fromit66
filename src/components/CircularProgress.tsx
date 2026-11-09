import React from 'react';

interface CircularProgressProps {
  value: number; // 0 to 100
  size?: number; // default 64
  strokeWidth?: number; // default 5.5
  currentStep?: number;
  totalSteps?: number;
  className?: string;
}

export default function CircularProgress({
  value,
  size = 64,
  strokeWidth = 5.5,
  currentStep,
  totalSteps,
  className = '',
}: CircularProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, Math.round(value)));
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <defs>
          <linearGradient id="routineProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="60%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <filter id="progressGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#10b981" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#0f172a"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Subtle accent track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#1e293b"
          strokeWidth={strokeWidth - 1.5}
          fill="transparent"
          strokeDasharray="2 4"
        />

        {/* Animated Progress Ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#routineProgressGrad)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          filter="url(#progressGlow)"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Center percentage content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono font-black text-white text-[13px] sm:text-sm tracking-tight leading-none drop-shadow-sm">
          {clampedValue}%
        </span>
        {currentStep !== undefined && totalSteps !== undefined && (
          <span className="text-[9px] text-slate-400 font-bold font-mono tracking-tighter leading-none mt-0.5">
            {currentStep}/{totalSteps}
          </span>
        )}
      </div>
    </div>
  );
}
