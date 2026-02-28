import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Sparkles, Copy, Send, Loader2, FileText, AlertTriangle,
  Clock, CheckCircle, MessageSquare, ArrowRight
} from "lucide-react";
import type { Project } from "@shared/schema";

type EmailPurpose =
  | 'sollecito_pagamento'
  | 'richiesta_informazioni'
  | 'aggiornamento_stato'
  | 'invio_documenti'
  | 'conferma_ricezione'
  | 'richiesta_approvazione'
  | 'comunicazione_ritardo'
  | 'custom';

interface EmailDraftResult {
  subject: string;
  body: string;
  recipientSuggestion?: string;
  tone: string;
  purpose: string;
  generatedAt: string;
}

const PURPOSE_OPTIONS: { value: EmailPurpose; label: string; icon: typeof Mail }[] = [
  { value: 'sollecito_pagamento', label: 'Sollecito pagamento', icon: AlertTriangle },
  { value: 'richiesta_informazioni', label: 'Richiesta informazioni', icon: MessageSquare },
  { value: 'aggiornamento_stato', label: 'Aggiornamento stato', icon: ArrowRight },
  { value: 'invio_documenti', label: 'Invio documenti', icon: FileText },
  { value: 'conferma_ricezione', label: 'Conferma ricezione', icon: CheckCircle },
  { value: 'richiesta_approvazione', label: 'Richiesta approvazione', icon: CheckCircle },
  { value: 'comunicazione_ritardo', label: 'Comunicazione ritardo', icon: Clock },
  { value: 'custom', label: 'Personalizzata', icon: Mail },
];

const TONE_OPTIONS = [
  { value: 'formale', label: 'Formale' },
  { value: 'cordiale', label: 'Cordiale' },
  { value: 'urgente', label: 'Urgente' },
] as const;

interface Props {
  project: Project;
  children?: React.ReactNode;
  replyToSubject?: string;
  replyToBody?: string;
}

export default function EmailDraftGenerator({ project, children, replyToSubject, replyToBody }: Props) {
  const [open, setOpen] = useState(false);
  const [purpose, setPurpose] = useState<EmailPurpose>('aggiornamento_stato');
  const [tone, setTone] = useState<string>('formale');
  const [customContext, setCustomContext] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [draft, setDraft] = useState<EmailDraftResult | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/email-draft", {
        projectId: project.id,
        purpose,
        customContext: customContext || undefined,
        recipientName: recipientName || undefined,
        recipientEmail: recipientEmail || undefined,
        tone,
        replyToSubject,
        replyToBody,
      });
      return response.json() as Promise<EmailDraftResult>;
    },
    onSuccess: (data) => {
      setDraft(data);
      setEditedSubject(data.subject);
      setEditedBody(data.body);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nella generazione della bozza",
        variant: "destructive",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!recipientEmail) {
        throw new Error("Inserire l'indirizzo email del destinatario");
      }
      const response = await apiRequest("POST", "/api/email/send", {
        to: recipientEmail,
        subject: editedSubject,
        text: editedBody,
        projectId: project.id,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email inviata",
        description: `Email inviata a ${recipientEmail}`,
      });
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore invio",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setDraft(null);
    setEditedSubject('');
    setEditedBody('');
    setCustomContext('');
  };

  const handleCopy = () => {
    const text = `Oggetto: ${editedSubject}\n\n${editedBody}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato", description: "Bozza email copiata negli appunti" });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Bozza AI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            Genera bozza email - {project.code}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Configuration */}
          {!draft && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Tipo email
                  </label>
                  <Select value={purpose} onValueChange={(v) => setPurpose(v as EmailPurpose)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Tono
                  </label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Destinatario (nome)
                  </label>
                  <Input
                    placeholder={project.client}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Email destinatario
                  </label>
                  <Input
                    type="email"
                    placeholder="email@esempio.it"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Indicazioni aggiuntive (opzionale)
                </label>
                <Textarea
                  placeholder="Es: menzionare la riunione del 15 marzo, allegare la relazione di calcolo..."
                  value={customContext}
                  onChange={(e) => setCustomContext(e.target.value)}
                  rows={3}
                />
              </div>

              {replyToSubject && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-blue-700 dark:text-blue-400">
                  Risposta a: {replyToSubject}
                </div>
              )}

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="w-full button-g2-primary"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generazione in corso...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Genera bozza con AI
                  </>
                )}
              </Button>
            </>
          )}

          {/* Generated Draft - Editable */}
          {draft && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">
                  {draft.purpose}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  Tono: {draft.tone}
                </Badge>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Oggetto
                </label>
                <Input
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Corpo email
                </label>
                <Textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={12}
                  className="text-sm font-mono"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={handleCopy}
                  className="gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copia
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={resetForm}
                  className="gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Rigenera
                </Button>
                <div className="flex-1" />
                <Button
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending || !recipientEmail}
                  className="button-g2-primary gap-1.5"
                  title={!recipientEmail ? "Inserire l'email del destinatario" : undefined}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Invia email
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
