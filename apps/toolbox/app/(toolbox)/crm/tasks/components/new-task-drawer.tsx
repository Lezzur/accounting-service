"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "../../../../../lib/supabase/client";
import type { Database, TaskPriority, TaskStatus } from "@numera/db";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerClose,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from "@numera/ui";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

interface EntityOption {
  id: string;
  name: string;
}

interface NewTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called on successful create or update */
  onSaved: (task: TaskRow) => void;
  /** When provided, drawer is in edit mode */
  editTask?: TaskRow | null;
}

export function NewTaskDrawer({
  open,
  onOpenChange,
  onSaved,
  editTask,
}: NewTaskDrawerProps) {
  const isEditing = !!editTask;

  // Form state
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [linkedEntityType, setLinkedEntityType] = useState<
    "lead" | "client" | ""
  >("");
  const [linkedEntityId, setLinkedEntityId] = useState("");
  const [selectedEntityName, setSelectedEntityName] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityInputRef = useRef<HTMLInputElement>(null);
  const entityDropdownRef = useRef<HTMLDivElement>(null);

  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  // Populate form when opening
  useEffect(() => {
    if (!open) return;
    if (editTask) {
      setTitle(editTask.title);
      setDueDate(editTask.due_date);
      setLinkedEntityType(editTask.linked_entity_type ?? "");
      setLinkedEntityId(editTask.linked_entity_id ?? "");
      setPriority(editTask.priority);
      setStatus(editTask.status);
      setNotes("");
      setSelectedEntityName("");
      setEntitySearch("");
    } else {
      setTitle("");
      setDueDate("");
      setLinkedEntityType("");
      setLinkedEntityId("");
      setSelectedEntityName("");
      setEntitySearch("");
      setEntityOptions([]);
      setPriority("medium");
      setStatus("todo");
      setNotes("");
    }
    setError(null);
  }, [open, editTask]);

  // Load entity options when type changes
  useEffect(() => {
    if (!linkedEntityType || !supabase) {
      setEntityOptions([]);
      return;
    }
    setEntityLoading(true);

    const fetchEntities = async () => {
      try {
        if (linkedEntityType === "lead") {
          const { data } = await supabase
            .from("leads")
            .select("id, business_name")
            .order("business_name");
          setEntityOptions(
            (data ?? []).map((r) => ({ id: r.id, name: r.business_name }))
          );
        } else {
          const { data } = await supabase
            .from("clients")
            .select("id, business_name")
            .order("business_name");
          setEntityOptions(
            (data ?? []).map((r) => ({ id: r.id, name: r.business_name }))
          );
        }
      } finally {
        setEntityLoading(false);
      }
    };
    fetchEntities();
  }, [linkedEntityType, supabase]);

  // Look up the entity name when editing (entityOptions loads async)
  useEffect(() => {
    if (!isEditing || !linkedEntityId || !entityOptions.length) return;
    const match = entityOptions.find((e) => e.id === linkedEntityId);
    if (match) setSelectedEntityName(match.name);
  }, [isEditing, linkedEntityId, entityOptions]);

  // Click outside to close entity dropdown
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        entityDropdownRef.current?.contains(e.target as Node) ||
        entityInputRef.current?.contains(e.target as Node)
      )
        return;
      setEntityDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const filteredEntities = entitySearch
    ? entityOptions.filter((e) =>
        e.name.toLowerCase().includes(entitySearch.toLowerCase())
      )
    : entityOptions;

  const handleEntityTypeChange = (val: string) => {
    setLinkedEntityType(val as "lead" | "client" | "");
    setLinkedEntityId("");
    setSelectedEntityName("");
    setEntitySearch("");
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !dueDate) return;

    setSaving(true);
    setError(null);

    if (!supabase) {
      setError("Failed to save task. Please try again.");
      setSaving(false);
      return;
    }

    try {
      if (isEditing && editTask) {
        const { data, error: dbError } = await supabase
          .from("tasks")
          .update({
            title: trimmedTitle,
            due_date: dueDate,
            linked_entity_type: linkedEntityType || null,
            linked_entity_id: linkedEntityId || null,
            priority,
            status,
          })
          .eq("id", editTask.id)
          .select()
          .single();
        if (dbError) throw dbError;
        if (data) {
          onSaved(data);
          onOpenChange(false);
        }
      } else {
        const { data, error: dbError } = await supabase
          .from("tasks")
          .insert({
            title: trimmedTitle,
            due_date: dueDate,
            linked_entity_type: linkedEntityType || null,
            linked_entity_id: linkedEntityId || null,
            priority,
            status: "todo",
            created_by: "user",
          })
          .select()
          .single();
        if (dbError) throw dbError;
        if (data) {
          onSaved(data);
          onOpenChange(false);
        }
      }
    } catch {
      setError("Failed to save task. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const isPastDue = dueDate && dueDate < today;

  const canSave =
    title.trim().length > 0 &&
    dueDate.length > 0 &&
    (!linkedEntityType || linkedEntityId);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{isEditing ? "Edit Task" : "New Task"}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-2">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Due Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {isPastDue && (
              <p className="text-xs text-amber-600">
                This date is in the past. Backdating is allowed.
              </p>
            )}
          </div>

          {/* Linked Entity Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Linked Entity Type
            </label>
            <Select
              value={linkedEntityType}
              onValueChange={handleEntityTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
            {linkedEntityType && (
              <button
                type="button"
                onClick={() => handleEntityTypeChange("")}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Linked Entity — searchable dropdown */}
          {linkedEntityType && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                {linkedEntityType === "lead" ? "Lead" : "Client"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  ref={entityInputRef}
                  value={selectedEntityName || entitySearch}
                  onChange={(e) => {
                    setEntitySearch(e.target.value);
                    setLinkedEntityId("");
                    setSelectedEntityName("");
                    setEntityDropdownOpen(true);
                  }}
                  onFocus={() => setEntityDropdownOpen(true)}
                  placeholder={
                    entityLoading
                      ? "Loading…"
                      : `Search ${linkedEntityType}s…`
                  }
                  disabled={entityLoading}
                />
                {entityDropdownOpen && filteredEntities.length > 0 && (
                  <div
                    ref={entityDropdownRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-md max-h-48 overflow-y-auto"
                  >
                    {filteredEntities.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:bg-teal-50"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setLinkedEntityId(entity.id);
                          setSelectedEntityName(entity.name);
                          setEntitySearch("");
                          setEntityDropdownOpen(false);
                        }}
                      >
                        {entity.name}
                      </button>
                    ))}
                  </div>
                )}
                {entityDropdownOpen &&
                  !entityLoading &&
                  entitySearch &&
                  filteredEntities.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-md px-3 py-2 text-sm text-slate-500">
                      No results found
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Priority
            </label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as TaskPriority)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status — only in edit mode */}
          {isEditing && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Status
              </label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Optional notes…"
              className={cn(
                "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900",
                "placeholder:text-slate-500 resize-none",
                "focus:outline-none focus:border-2 focus:border-teal-600 transition-[border-color,border-width] duration-[100ms]"
              )}
            />
            <p className="text-xs text-slate-400 text-right">
              {notes.length}/1000
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DrawerFooter>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving…
              </span>
            ) : (
              "Save"
            )}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
