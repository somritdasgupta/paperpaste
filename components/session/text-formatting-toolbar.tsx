"use client";

import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Strikethrough,
  Superscript,
  Subscript,
  Code,
  Link,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TextFormattingToolbarProps {
  onFormat: (format: string, value?: string) => void;
  disabled?: boolean;
}

export default function TextFormattingToolbar({
  onFormat,
  disabled = false,
}: TextFormattingToolbarProps) {
  const formatButtons = [
    { icon: Bold, format: "bold", tooltip: "Bold (Ctrl+B)", wrapper: "**" },
    {
      icon: Italic,
      format: "italic",
      tooltip: "Italic (Ctrl+I)",
      wrapper: "*",
    },
    {
      icon: Strikethrough,
      format: "strikethrough",
      tooltip: "Strikethrough",
      wrapper: "~~",
    },
    { icon: Code, format: "code", tooltip: "Inline Code", wrapper: "`" },
    {
      icon: Superscript,
      format: "superscript",
      tooltip: "Superscript",
      wrapper: "^",
    },
    {
      icon: Subscript,
      format: "subscript",
      tooltip: "Subscript",
      wrapper: "~",
    },
    { icon: Link, format: "link", tooltip: "Insert Link", wrapper: "[](url)" },
  ];

  return (
    <div className="flex items-center gap-1 p-2 bg-muted/30 rounded-lg border border-border">
      <TooltipProvider>
        {formatButtons.map(({ icon: Icon, format, tooltip, wrapper }) => (
          <Tooltip key={format}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onFormat(format, wrapper)}
                className="h-8 w-8 p-0 hover:bg-primary/10"
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}
