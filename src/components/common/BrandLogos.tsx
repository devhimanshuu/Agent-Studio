import React from "react";

/**
 * Official Brand SVG Logos for Workflow & Multi-Agent Ecosystems
 * Pixel-accurate vector marks with proper accessible labels and scalability.
 */

export function N8nOfficialLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="n8n Official Logo"
    >
      <rect width="100" height="100" rx="20" fill="#EA4B71" />
      <circle cx="27" cy="42" r="11" fill="white" />
      <circle cx="50" cy="62" r="11" fill="white" />
      <circle cx="73" cy="42" r="11" fill="white" />
      <path
        d="M34 47L43 57M57 57L66 47"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DifyOfficialLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Dify Official Logo"
    >
      <rect width="100" height="100" rx="20" fill="url(#dify-grad-bg)" />
      <path
        d="M28 24C28 21.7909 29.7909 20 32 20H52C68.5685 20 82 33.4315 82 50C82 66.5685 68.5685 80 52 80H32C29.7909 80 28 78.2091 28 76V24Z"
        fill="white"
      />
      <path
        d="M44 36H51C58.732 36 65 42.268 65 50C65 57.732 58.732 64 51 64H44V36Z"
        fill="#155EEF"
      />
      <circle cx="44" cy="50" r="4.5" fill="white" />
      <defs>
        <linearGradient id="dify-grad-bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SmitheryOfficialLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 135 159" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-label="Smithery.ai Official Logo">
      <path d="M31.3508 58.4053H0V78.9492C0 90.8872 9.67578 100.563 21.6138 100.563H42.1577V69.2122C42.1577 63.2432 37.3198 58.4053 31.3508 58.4053Z" fill="#FF5601"/>
      <path d="M46.2327 69.2122V100.563H77.5835C83.5525 100.563 88.3904 95.7251 88.3904 89.7561V58.4053H57.0396C51.0706 58.4053 46.2327 63.2432 46.2327 69.2122Z" fill="#FF5601"/>
      <path d="M113.013 58.4053H92.4695V89.7561C92.4695 95.7251 97.3074 100.563 103.276 100.563H134.627V80.0191C134.627 68.0811 124.951 58.4053 113.013 58.4053Z" fill="#FF5601"/>
      <path d="M0.000244141 37.5535V54.351H31.3511C37.3201 54.351 42.158 49.5131 42.158 43.5441V6.01534C40.9332 5.97572 39.6616 5.9541 38.3323 5.9541C17.9865 5.9541 0.000244141 15.9001 0.000244141 37.5535Z" fill="#FF5601"/>
      <path d="M46.2327 43.5332C46.2327 49.5022 51.0706 54.3401 57.0396 54.3401H88.3904V14.4735C71.0993 12.8596 64.1109 7.47418 46.2327 6.21338V43.5368V43.5332Z" fill="#FF5601"/>
      <path d="M98.8636 14.9351C96.5833 14.9351 94.4616 14.8775 92.4695 14.773V54.3443H113.013C124.951 54.3443 134.627 44.6685 134.627 32.7305V0C127.945 8.91209 116.097 14.9351 98.8636 14.9351Z" fill="#FF5601"/>
      <path d="M35.7697 144.068C38.05 144.068 40.1718 144.126 42.1638 144.23V104.659H21.6199C9.68188 104.659 0.00610352 114.335 0.00610352 126.273V159C6.68837 150.088 18.5363 144.065 35.7733 144.065L35.7697 144.068Z" fill="#FF5601"/>
      <path d="M88.3904 115.466C88.3904 109.497 83.5525 104.659 77.5835 104.659H46.2327V144.529C63.5237 146.143 70.5122 151.529 88.3904 152.79V115.466Z" fill="#FF5601"/>
      <path d="M134.627 121.5V104.659H103.276C97.3074 104.659 92.4695 109.497 92.4695 115.466V152.995C93.6943 153.034 94.9659 153.052 96.2951 153.052C116.63 153.052 134.606 143.121 134.627 121.496V121.5Z" fill="#FF5601"/>
    </svg>
  );
}

export function GroqOfficialLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Groq Official Logo"
    >
      <path
        d="M14.6579 2.84175L2.93749 15.0764L10.1882 16.9344L6.93985 26.2607L18.6603 14.026L11.4096 12.168L14.6579 2.84175Z"
        fill="#F55036"
      />
    </svg>
  );
}

export function OpenRouterOfficialLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="19.82 17.199 365.556 258.298"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="OpenRouter Official Logo"
    >
      <path d="M303.9475,17.19926c42.79734,0,77.48933,34.69327,77.48933,77.48933s-34.69199,77.48933-77.48933,77.48933l76.86166,76.86244c9.76367,9.76313,2.84903,26.45667-10.95697,26.45667h-220.88335c-71.32686,0-129.14889-57.82202-129.14889-129.14889S77.64197,17.19926,148.96884,17.19926h154.97866ZM148.96884,68.85881c-42.79607,0-77.48933,34.69327-77.48933,77.48933s34.69327,77.48933,77.48933,77.48933,77.48933-34.69327,77.48933-77.48933-34.69327-77.48933-77.48933-77.48933Z" />
    </svg>
  );
}
