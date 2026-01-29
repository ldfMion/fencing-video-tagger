"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface TagFormProps {
  currentTime: number;
  onAddTag: (text: string, timestamp: number) => void;
  disabled?: boolean;
}

export function TagForm({ currentTime, onAddTag, disabled }: TagFormProps) {
  const [text, setText] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;
      onAddTag(text.trim(), currentTime);
      setText("");
    },
    [text, currentTime, onAddTag]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Add tag at {formatTime(currentTime)}
      </p>
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter tag text..."
          disabled={disabled}
        />
        <Button type="submit" disabled={disabled || !text.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    </form>
  );
}
