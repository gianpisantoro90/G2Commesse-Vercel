import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Project } from "@shared/schema";

interface ProjectComboboxProps {
  projects: Project[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProjectCombobox({
  projects,
  value,
  onValueChange,
  placeholder = "Seleziona progetto",
  disabled = false,
  className,
}: ProjectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Find selected project
  const selectedProject = value && value !== "none"
    ? projects.find((project) => project.id === value)
    : null;

  // Filter projects based on search query
  const filteredProjects = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    const query = searchQuery.toLowerCase();
    return projects.filter((project) =>
      project.code.toLowerCase().includes(query) ||
      (project.object && project.object.toLowerCase().includes(query)) ||
      (project.client && project.client.toLowerCase().includes(query))
    );
  }, [projects, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white",
            !selectedProject && "text-gray-500 dark:text-gray-400",
            className
          )}
        >
          <span className="truncate">
            {selectedProject
              ? `${selectedProject.code} - ${selectedProject.object || 'Senza oggetto'}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" align="start">
        <Command className="bg-white dark:bg-gray-800">
          <CommandInput
            placeholder="Cerca per codice o oggetto..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="text-gray-900 dark:text-white"
          />
          <CommandList>
            <CommandEmpty className="text-gray-600 dark:text-gray-400">
              Nessun progetto trovato
            </CommandEmpty>
            <CommandGroup>
              {/* Opzione "Nessun progetto" */}
              <CommandItem
                value="none"
                onSelect={() => {
                  onValueChange(null);
                  setOpen(false);
                  setSearchQuery("");
                }}
                className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    !selectedProject ? "opacity-100" : "opacity-0"
                  )}
                />
                Nessun progetto
              </CommandItem>

              {/* Lista progetti filtrati */}
              {filteredProjects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.code}
                  onSelect={() => {
                    onValueChange(project.id === value ? null : project.id);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                  className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === project.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium">{project.code}</span>
                    {project.object && (
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {project.object}
                      </span>
                    )}
                    {project.client && (
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        Cliente: {project.client}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
