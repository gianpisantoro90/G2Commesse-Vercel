import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, Send, X, Loader2, MessageSquare, Trash2 } from "lucide-react";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("Nuova conversazione");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await apiRequest("POST", "/api/ai/chat", {
        message: trimmed,
        conversationId,
      });
      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      if (data.conversationId) setConversationId(data.conversationId);
      if (data.title) setConversationTitle(data.title);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Errore sconosciuto";
      toast({
        title: "Errore AI",
        description: errMsg,
        variant: "destructive",
      });
      // Remove user message on error
      setMessages(prev => prev.slice(0, -1));
      setInput(trimmed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
    setConversationTitle("Nuova conversazione");
  };

  const quickPrompts = [
    "Qual e' lo stato generale dei progetti attivi?",
    "Ci sono prestazioni completate da fatturare?",
    "Quali scadenze sono prossime?",
    "Riassumi le comunicazioni recenti",
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg button-g2-primary z-50"
          size="icon"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:w-[440px] p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-800 dark:text-blue-400" />
              <div>
                <SheetTitle className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Assistente AI G2
                </SheetTitle>
                <p className="text-xs text-blue-700 dark:text-blue-400">{conversationTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearConversation} title="Nuova conversazione">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4 py-3">
          {messages.length === 0 ? (
            <div className="space-y-4 py-8">
              <div className="text-center space-y-2">
                <Bot className="h-12 w-12 mx-auto text-blue-300 dark:text-blue-800" />
                <h3 className="font-semibold text-foreground">Ciao! Sono l'assistente AI di G2</h3>
                <p className="text-sm text-muted-foreground">
                  Posso aiutarti con informazioni su progetti, fatturazione, scadenze e comunicazioni.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggerimenti rapidi</p>
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    className="w-full text-left text-sm p-3 rounded-lg border border-border hover:bg-muted transition-colors text-foreground"
                    onClick={() => {
                      setInput(prompt);
                      inputRef.current?.focus();
                    }}
                  >
                    <MessageSquare className="h-3 w-3 inline mr-2 text-blue-500" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-700 text-white'
                      : 'bg-muted text-foreground'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                        <AiMarkdown content={msg.content} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-muted-foreground'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="px-4 py-3 border-t bg-background">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi un messaggio..."
              className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-10 w-10 button-g2-primary shrink-0"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">
            Shift+Invio per andare a capo
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Simple markdown renderer for AI responses */
function AiMarkdown({ content }: { content: string }) {
  // Simple markdown to HTML conversion for common patterns
  const html = content
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>')
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Unordered lists
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines within content
    .replace(/\n/g, '<br/>');

  return <div dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}
