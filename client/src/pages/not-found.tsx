import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-2xl font-bold text-foreground">Pagina non trovata</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            La pagina richiesta non esiste o non è più disponibile.
          </p>
          <Button onClick={() => setLocation("/")} className="gap-2">
            <Home className="h-4 w-4" />
            Torna alla Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
