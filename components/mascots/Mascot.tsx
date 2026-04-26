import { cn } from "@/lib/utils/cn";

export type AvatarKey = "fox" | "owl" | "panda" | "dragon" | "bear" | "cat";

export const MASCOT_META: Record<AvatarKey, { label: string; description: string }> = {
  fox:    { label: "Kira the Fox",    description: "Clever & curious. Always finds a shortcut to the answer." },
  owl:    { label: "Ollie the Owl",   description: "Wise & patient. Knows every subject inside out." },
  panda:  { label: "Mochi the Panda", description: "Calm & focused. Takes it one lesson at a time." },
  dragon: { label: "Ruru the Dragon", description: "Powerful & ambitious. Breathes fire through hard problems." },
  bear:   { label: "Bobo the Bear",   description: "Determined & warm. Never gives up on a streak." },
  cat:    { label: "Luna the Cat",    description: "Curious & independent. Explores every corner of the map." },
};

interface MascotProps {
  avatarKey: AvatarKey | string;
  size?: number;
  className?: string;
}

export function Mascot({ avatarKey, size = 96, className }: MascotProps) {
  const svgs: Record<AvatarKey, React.ReactNode> = {
    fox: (
      <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="44" fill="#FF7A3D"/>
        <polygon points="16,28 28,52 4,52" fill="#FF7A3D"/>
        <polygon points="80,28 92,52 68,52" fill="#FF7A3D"/>
        <polygon points="18,30 27,48 10,48" fill="#FFBFA0"/>
        <polygon points="78,30 88,48 68,48" fill="#FFBFA0"/>
        <ellipse cx="48" cy="56" rx="26" ry="22" fill="#FFF0E6"/>
        <circle cx="37" cy="46" r="7" fill="white"/>
        <circle cx="59" cy="46" r="7" fill="white"/>
        <circle cx="38" cy="46" r="4" fill="#2D1B00"/>
        <circle cx="60" cy="46" r="4" fill="#2D1B00"/>
        <circle cx="39" cy="44" r="1.5" fill="white"/>
        <circle cx="61" cy="44" r="1.5" fill="white"/>
        <ellipse cx="48" cy="58" rx="4" ry="3" fill="#E05A2B"/>
        <path d="M42 63 Q48 68 54 63" stroke="#2D1B00" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="31" cy="58" r="6" fill="#FF9B7A" opacity="0.5"/>
        <circle cx="65" cy="58" r="6" fill="#FF9B7A" opacity="0.5"/>
      </svg>
    ),
    owl: (
      <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="44" fill="#6C63FF"/>
        <ellipse cx="34" cy="14" rx="8" ry="12" fill="#6C63FF" transform="rotate(-15 34 14)"/>
        <ellipse cx="62" cy="14" rx="8" ry="12" fill="#6C63FF" transform="rotate(15 62 14)"/>
        <ellipse cx="48" cy="60" rx="22" ry="24" fill="#E8E4FF"/>
        <circle cx="36" cy="44" r="13" fill="white"/>
        <circle cx="60" cy="44" r="13" fill="white"/>
        <circle cx="36" cy="44" r="9" fill="#FFC84A"/>
        <circle cx="60" cy="44" r="9" fill="#FFC84A"/>
        <circle cx="36" cy="44" r="5" fill="#1A1A2E"/>
        <circle cx="60" cy="44" r="5" fill="#1A1A2E"/>
        <circle cx="37.5" cy="42" r="2" fill="white"/>
        <circle cx="61.5" cy="42" r="2" fill="white"/>
        <polygon points="48,52 44,58 52,58" fill="#FFC84A"/>
        <path d="M27 34 Q36 30 45 34" stroke="#4A3F99" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M51 34 Q60 30 69 34" stroke="#4A3F99" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    panda: (
      <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="44" fill="#F0F0F0"/>
        <circle cx="22" cy="22" r="14" fill="#2D2D2D"/>
        <circle cx="74" cy="22" r="14" fill="#2D2D2D"/>
        <ellipse cx="35" cy="44" rx="12" ry="11" fill="#2D2D2D" transform="rotate(-10 35 44)"/>
        <ellipse cx="61" cy="44" rx="12" ry="11" fill="#2D2D2D" transform="rotate(10 61 44)"/>
        <circle cx="35" cy="44" r="7" fill="white"/>
        <circle cx="61" cy="44" r="7" fill="white"/>
        <circle cx="35" cy="45" r="4" fill="#1A1A1A"/>
        <circle cx="61" cy="45" r="4" fill="#1A1A1A"/>
        <circle cx="36" cy="43" r="1.5" fill="white"/>
        <circle cx="62" cy="43" r="1.5" fill="white"/>
        <ellipse cx="48" cy="57" rx="4" ry="3" fill="#2D2D2D"/>
        <path d="M43 62 Q48 67 53 62" stroke="#2D2D2D" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="30" cy="60" r="7" fill="#FFB3C6" opacity="0.6"/>
        <circle cx="66" cy="60" r="7" fill="#FFB3C6" opacity="0.6"/>
      </svg>
    ),
    dragon: (
      <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="44" fill="#00C896"/>
        <polygon points="32,8 26,28 38,28" fill="#00A07A"/>
        <polygon points="64,8 58,28 70,28" fill="#00A07A"/>
        <polygon points="32,10 27,26 37,26" fill="#FFE066"/>
        <polygon points="64,10 59,26 69,26" fill="#FFE066"/>
        <ellipse cx="48" cy="54" rx="28" ry="24" fill="#00E8A8"/>
        <circle cx="37" cy="46" r="8" fill="white"/>
        <circle cx="59" cy="46" r="8" fill="white"/>
        <ellipse cx="37" cy="47" rx="4" ry="5" fill="#1A3A2A"/>
        <ellipse cx="59" cy="47" rx="4" ry="5" fill="#1A3A2A"/>
        <circle cx="38" cy="44" r="2" fill="white"/>
        <circle cx="60" cy="44" r="2" fill="white"/>
        <circle cx="44" cy="58" r="2" fill="#00A07A"/>
        <circle cx="52" cy="58" r="2" fill="#00A07A"/>
        <path d="M39 64 Q48 71 57 64" stroke="#00805E" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M34 72 Q48 80 62 72" stroke="#00A07A" strokeWidth="1.5" fill="none" opacity="0.5"/>
      </svg>
    ),
    bear: (
      <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="44" fill="#B07D4A"/>
        <circle cx="20" cy="22" r="13" fill="#B07D4A"/>
        <circle cx="76" cy="22" r="13" fill="#B07D4A"/>
        <circle cx="20" cy="22" r="8" fill="#8A5C2E"/>
        <circle cx="76" cy="22" r="8" fill="#8A5C2E"/>
        <ellipse cx="48" cy="60" rx="18" ry="14" fill="#D4A574"/>
        <circle cx="36" cy="44" r="7" fill="#2D1B00"/>
        <circle cx="60" cy="44" r="7" fill="#2D1B00"/>
        <circle cx="37.5" cy="42" r="2.5" fill="white"/>
        <circle cx="61.5" cy="42" r="2.5" fill="white"/>
        <ellipse cx="48" cy="55" rx="5" ry="4" fill="#5C3A1A"/>
        <path d="M42 61 Q48 67 54 61" stroke="#5C3A1A" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <circle cx="29" cy="57" r="7" fill="#CC8844" opacity="0.5"/>
        <circle cx="67" cy="57" r="7" fill="#CC8844" opacity="0.5"/>
      </svg>
    ),
    cat: (
      <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="44" fill="#8B6FD4"/>
        <polygon points="18,10 10,34 34,34" fill="#8B6FD4"/>
        <polygon points="78,10 86,34 62,34" fill="#8B6FD4"/>
        <polygon points="20,14 14,32 30,32" fill="#C4ADEE"/>
        <polygon points="76,14 82,32 66,32" fill="#C4ADEE"/>
        <circle cx="48" cy="52" r="26" fill="#C4ADEE"/>
        <ellipse cx="37" cy="46" rx="9" ry="7" fill="white"/>
        <ellipse cx="59" cy="46" rx="9" ry="7" fill="white"/>
        <ellipse cx="37" cy="46" rx="5" ry="6" fill="#2D9E5A"/>
        <ellipse cx="59" cy="46" rx="5" ry="6" fill="#2D9E5A"/>
        <ellipse cx="37" cy="46" rx="2" ry="5" fill="#1A1A2E"/>
        <ellipse cx="59" cy="46" rx="2" ry="5" fill="#1A1A2E"/>
        <circle cx="37" cy="44" r="1.5" fill="white"/>
        <circle cx="59" cy="44" r="1.5" fill="white"/>
        <polygon points="48,56 45,59 51,59" fill="#E06090"/>
        <line x1="20" y1="58" x2="40" y2="60" stroke="#7A60B0" strokeWidth="1.5" opacity="0.6"/>
        <line x1="20" y1="62" x2="40" y2="62" stroke="#7A60B0" strokeWidth="1.5" opacity="0.6"/>
        <line x1="56" y1="60" x2="76" y2="58" stroke="#7A60B0" strokeWidth="1.5" opacity="0.6"/>
        <line x1="56" y1="62" x2="76" y2="62" stroke="#7A60B0" strokeWidth="1.5" opacity="0.6"/>
        <path d="M44 62 Q48 67 52 62" stroke="#C0709A" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </svg>
    ),
  };

  const svg = svgs[avatarKey as AvatarKey] ?? svgs.owl;
  return <span className={cn("inline-flex shrink-0", className)}>{svg}</span>;
}
