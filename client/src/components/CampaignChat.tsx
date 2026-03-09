import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Loader2, MessageCircle, Sparkles } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function CampaignChat({ campaign }: { campaign: any }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch campaign context for summary badges
  const { data: outcomeTotals } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaign.id}/outcome-totals`, "30days"],
    enabled: !!campaign.id,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaign.id}/outcome-totals?dateRange=30days`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: kpisList = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/kpis`],
    enabled: !!campaign.id,
  });

  const { data: benchmarksList = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaign.id}/benchmarks`],
    enabled: !!campaign.id,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async (content?: string) => {
    const messageContent = content || input.trim();
    if (!messageContent || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageContent,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await apiRequest("POST", `/api/campaigns/${campaign.id}/chat`, {
        messages: updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      const data = await resp.json();

      if (data.success && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.message || "Sorry, I encountered an error. Please try again.",
            timestamp: new Date(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I couldn't connect to the AI service. Please check your configuration and try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const totalSpend = Number(outcomeTotals?.spend?.unifiedSpend || 0);
  const totalRevenue = Number(outcomeTotals?.revenue?.totalRevenue || 0);
  const roas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(1) : "—";

  const suggestedQuestions = [
    "How is my campaign performing?",
    "Which KPIs need attention?",
    "What should I do to improve ROAS?",
    "Summarize my spend breakdown",
  ];

  return (
    <Card className="flex flex-col" style={{ height: "calc(100vh - 300px)", minHeight: "500px" }}>
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span>Campaign AI Chat</span>
        </CardTitle>
        <CardDescription>
          Ask questions about your campaign performance, KPIs, and benchmarks
        </CardDescription>
        {/* Context summary badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant="outline" className="text-xs">
            Spend: ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Revenue: ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
          </Badge>
          <Badge variant="outline" className="text-xs">
            ROAS: {roas}x
          </Badge>
          <Badge variant="outline" className="text-xs">
            {kpisList.length} KPIs
          </Badge>
          <Badge variant="outline" className="text-xs">
            {benchmarksList.length} Benchmarks
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Campaign Analytics Assistant
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                  I have access to your campaign data including spend, revenue, KPIs, and benchmarks. Ask me anything about your campaign performance.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
                    }`}
                  >
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                    <div
                      className={`text-xs mt-1 ${
                        msg.role === "user" ? "text-blue-200" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing your campaign data...
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your campaign performance..."
              className="resize-none min-h-[44px] max-h-[120px]"
              rows={1}
              disabled={isLoading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="flex-shrink-0 h-[44px] w-[44px]"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
