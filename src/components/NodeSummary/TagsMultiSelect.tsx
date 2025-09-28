import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { Button } from "../ui/Button";

function TagsMultiSelect({
  allTags,
  value,
  onChange,
}: {
  allTags: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const toggle = (tag: string) => {
    const has = value.includes(tag);
    onChange(has ? value.filter((t) => t !== tag) : [...value, tag]);
  };
  const clearOne = (tag: string) => onChange(value.filter((t) => t !== tag));
  const clearAll = () => onChange([]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[220px] justify-between">
            {value.length
              ? `${value.length} tag${value.length > 1 ? "s" : ""} selected`
              : "Filter by tags"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0 bg-white shadow-md border border-gray-200">
          <Command shouldFilter defaultValue="">
            <CommandInput placeholder="Search tags..." />
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {allTags.map((tag) => (
                <CommandItem
                  key={tag}
                  value={tag}
                  onSelect={() => toggle(tag)}
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    checked={value.includes(tag)}
                    onCheckedChange={() => toggle(tag)}
                  />
                  <span className="truncate">{tag}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap gap-1">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700"
          >
            {t}
            <button
              className="p-0.5 hover:text-gray-900"
              onClick={() => clearOne(t)}
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

export default TagsMultiSelect;
