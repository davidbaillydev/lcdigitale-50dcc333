import { useEffect, useRef, useState, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = { id: string; name: string };

export function OptionSortableList<T extends Row>({ items, label, onReorder, children }: {
  items: T[]; label: string; onReorder: (rows: T[]) => Promise<void>; children: (row: T) => ReactNode;
}) {
  const [rows, setRows] = useState(items);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => { if (!pending.current) setRows(items); }, [items]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = async (from: number, to: number) => {
    if (pending.current || from < 0 || to < 0 || to >= rows.length || from === to) return;
    const next = arrayMove(rows, from, to);
    pending.current = true; setBusy(true); setRows(next);
    try { await onReorder(next); }
    catch { setRows(items); }
    finally { pending.current = false; setBusy(false); }
  };
  const dropped = ({ active, over }: DragEndEvent) => {
    if (over) void move(rows.findIndex((r) => r.id === active.id), rows.findIndex((r) => r.id === over.id));
  };
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dropped}>
    <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
      <div className="space-y-2" role="list" aria-label={label} aria-busy={busy}>
        {rows.map((row, index) => <SortableRow key={row.id} row={row} first={index === 0} last={index === rows.length - 1} busy={busy} move={(d) => void move(index, index + d)}>{children(row)}</SortableRow>)}
      </div>
    </SortableContext>
  </DndContext>;
}

function SortableRow({ row, first, last, busy, move, children }: {
  row: Row; first: boolean; last: boolean; busy: boolean; move: (delta: number) => void; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled: busy });
  return <div ref={setNodeRef} role="listitem" data-option-id={row.id}
    style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`relative min-w-0 ${isDragging ? "z-10 opacity-70" : ""}`}>
    <div className="mb-1 flex items-center gap-1">
      <Button type="button" size="icon" variant="ghost" className="h-11 w-11 shrink-0 touch-none cursor-grab active:cursor-grabbing" disabled={busy} {...attributes} {...listeners} aria-label={`Déplacer ${row.name}`} title={`Glisser pour déplacer ${row.name}`}><GripVertical /></Button>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
      <Button type="button" size="icon" variant="outline" className="h-11 w-11 shrink-0" disabled={busy || first} onClick={() => move(-1)} aria-label={`Monter ${row.name}`} title={`Monter ${row.name}`}><ArrowUp /></Button>
      <Button type="button" size="icon" variant="outline" className="h-11 w-11 shrink-0" disabled={busy || last} onClick={() => move(1)} aria-label={`Descendre ${row.name}`} title={`Descendre ${row.name}`}><ArrowDown /></Button>
    </div>
    {children}
  </div>;
}