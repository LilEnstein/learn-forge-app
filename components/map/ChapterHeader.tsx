interface Props {
  title: string;
}

export function ChapterHeader({ title }: Props) {
  return (
    <div className="w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide bg-violet-100 text-violet-700 my-4">
      {title}
    </div>
  );
}
