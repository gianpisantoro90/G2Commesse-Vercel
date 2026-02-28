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
import type { Client } from "@shared/schema";

interface ClientComboboxProps {
  clients: Client[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ClientCombobox({
  clients,
  value,
  onValueChange,
  placeholder = "Seleziona cliente",
  disabled = false,
  className,
}: ClientComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const selectedClient = value
    ? clients.find((client) => client.name === value)
    : null;

  const filteredClients = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return clients;
    }
    const query = searchQuery.toLowerCase();
    return clients.filter((client) =>
      client.name.toLowerCase().includes(query) ||
      client.sigla.toLowerCase().includes(query) ||
      (client.city && client.city.toLowerCase().includes(query))
    );
  }, [clients, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between bg-card border-border text-foreground",
            !selectedClient && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedClient
              ? `${selectedClient.name} (${selectedClient.sigla})`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-card border-border" align="start">
        <Command className="bg-card">
          <CommandInput
            placeholder="Cerca per nome, sigla o città..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="text-foreground"
          />
          <CommandList>
            <CommandEmpty className="text-muted-foreground">
              Nessun cliente trovato
            </CommandEmpty>
            <CommandGroup>
              {filteredClients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={client.name}
                  onSelect={() => {
                    onValueChange(value === client.name ? null : client.name);
                    setOpen(false);
                    setSearchQuery("");
                  }}
                  className="text-foreground hover:bg-muted"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === client.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-medium">{client.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {client.sigla}
                      {client.city && ` • ${client.city}`}
                    </span>
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
