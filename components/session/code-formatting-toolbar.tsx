"use client";

import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  WrapText,
  Indent,
  Outdent,
  Braces,
  Code2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CodeFormattingToolbarProps {
  onFormat: (format: string) => void;
  disabled?: boolean;
}

export default function CodeFormattingToolbar({
  onFormat,
  disabled = false,
}: CodeFormattingToolbarProps) {
  const formatButtons = [
    {
      icon: MessageSquare,
      format: "comment",
      tooltip: "Toggle Comment (Ctrl+/) - Language-aware",
    },
    { icon: WrapText, format: "wrap", tooltip: "Wrap Long Lines (80 chars)" },
    { icon: Indent, format: "indent", tooltip: "Indent Selection (Tab)" },
    {
      icon: Outdent,
      format: "outdent",
      tooltip: "Outdent Selection (Shift+Tab)",
    },
    {
      icon: Braces,
      format: "braces",
      tooltip: "Check Braces/Brackets/Parentheses",
    },
    { icon: Code2, format: "format", tooltip: "Fix Indentation" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/30 rounded border border-border">
      <TooltipProvider>
        {formatButtons.map(({ icon: Icon, format, tooltip }) => (
          <Tooltip key={format}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => onFormat(format)}
                className="h-6 w-6 p-0 hover:bg-primary/10"
              >
                <Icon className="h-3.5 w-3.5" />
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
