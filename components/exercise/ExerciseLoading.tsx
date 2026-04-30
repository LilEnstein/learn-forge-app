export function ExerciseLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-2 bg-muted rounded-full w-full" />
      <div className="h-8 bg-muted rounded w-3/4" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}
