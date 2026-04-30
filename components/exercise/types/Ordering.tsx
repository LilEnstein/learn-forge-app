"use client";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="p-3 bg-card border rounded-xl cursor-grab active:cursor-grabbing flex items-center gap-2"
    >
      <span className="text-muted-foreground">⠿</span>
      <span className="text-sm font-medium">{id}</span>
    </div>
  );
}

interface Props {
  question: string;
  options: string[];
  onSubmit: (answer: string[]) => void;
  disabled: boolean;
}

export function Ordering({ question, options, onSubmit, disabled }: Props) {
  const [items, setItems] = useState(() => [...options].sort(() => Math.random() - 0.5));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) =>
        arrayMove(
          items,
          items.indexOf(String(active.id)),
          items.indexOf(String(over.id))
        )
      );
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-xl font-semibold">{question}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableItem key={item} id={item} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        disabled={disabled}
        onClick={() => onSubmit(items)}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
      >
        Check
      </button>
    </div>
  );
}
