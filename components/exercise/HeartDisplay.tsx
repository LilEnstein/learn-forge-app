interface Props { hearts: number; maxHearts: number; }

export function HeartDisplay({ hearts, maxHearts }: Props) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: maxHearts }).map((_, i) => (
        <span
          key={i}
          className={`text-xl transition-opacity ${i < hearts ? "opacity-100" : "opacity-25"}`}
        >
          ❤️
        </span>
      ))}
    </div>
  );
}
