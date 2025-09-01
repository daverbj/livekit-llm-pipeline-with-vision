import React from 'react';

interface QuantiVisionLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function QuantiVisionLogo({ className = '', size = 'md' }: QuantiVisionLogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer circle */}
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
      
      {/* Inner geometric pattern representing quantum/vision */}
      <g>
        {/* Center diamond */}
        <path
          d="M50 20 L70 40 L50 60 L30 40 Z"
          fill="currentColor"
          opacity="0.8"
        />
        
        {/* Quantum dots */}
        <circle cx="35" cy="25" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="65" cy="25" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="25" cy="50" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="75" cy="50" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="35" cy="75" r="3" fill="currentColor" opacity="0.6" />
        <circle cx="65" cy="75" r="3" fill="currentColor" opacity="0.6" />
        
        {/* Vision lines */}
        <path
          d="M20 50 Q35 40 50 50 Q65 60 80 50"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.7"
        />
        
        {/* Neural network connections */}
        <path
          d="M35 25 L50 40 M65 25 L50 40 M50 40 L25 50 M50 40 L75 50 M50 60 L35 75 M50 60 L65 75"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.4"
        />
        
        {/* Central eye/lens */}
        <circle
          cx="50"
          cy="50"
          r="8"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r="3"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

interface QuantiVisionWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export function QuantiVisionWordmark({ 
  className = '', 
  size = 'md',
  showTagline = false 
}: QuantiVisionWordmarkProps) {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <QuantiVisionLogo size={size} className="text-indigo-600" />
      <div>
        <h1 className={`font-bold text-gray-900 ${sizeClasses[size]}`}>
          QuantiVision
        </h1>
        {showTagline && (
          <p className="text-xs text-gray-500 -mt-1">
            AI-Powered Vision Analytics
          </p>
        )}
      </div>
    </div>
  );
}
