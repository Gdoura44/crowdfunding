import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { expertApi } from "../api/expert";
import { useAuth } from "../hooks/useAuth.js";
import { extractApiError } from "../utils/apiError";
import {
  Loader2, AlertTriangle, MessageSquare, Send,
  UserCircle, BrainCircuit, CheckCheck, MessagesSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

function StatusBadge({ status }) {
  const map = {
    OPEN: "bg-green-100 text-green-800 border-green-200",
    IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
    CLOSED: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const labels = { OPEN: "Ouvert", IN_PROGRESS: "En cours", CLOSED: "Clôturé" };
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${map[status] || map.OPEN}`}>
      {labels[status] || status}
    </Badge>
  );
}

export default function ExpertConsultations() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isExpert = ["EXPERT", "ADMIN"].includes(user?.role);

  const [consultations, setConsultations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const [current, setCurrent] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [msgContent, setMsgContent] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");

  const messagesEndRef = useRef(null);

  const loadList = useCallback(async () => {
    try {
      const { data } = await expertApi.listConsultations({ limit: 50 });
      setConsultations(data.consultations || []);
    } catch (err) {
      setListError(extractApiError(err, "Impossible de charger les consultations.").message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetail = useCallback(async (consultId) => {
    setLoadingDetail(true);
    setDetailError("");
    try {
      const { data } = await expertApi.getConsultation(consultId);
      setCurrent(data.consultation);
    } catch (err) {
      setDetailError(extractApiError(err, "Consultation introuvable.").message);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (id) loadDetail(id); }, [id, loadDetail]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [current?.messages?.length]);

  async function sendMessage() {
    if (!msgContent.trim()) return;
    setSendingMsg(true);
    setMsgError("");
    try {
      const { data } = await expertApi.sendMessage(current._id, { content: msgContent.trim() });
      setCurrent(data.consultation);
      setMsgContent("");
      await loadList();
    } catch (err) {
      setMsgError(extractApiError(err, "Envoi impossible.").message);
    } finally {
      setSendingMsg(false);
    }
  }

  async function closeConsultation() {
    if (!current) return;
    setClosing(true);
    setCloseError("");
    try {
      const { data } = await expertApi.closeConsultation(current._id);
      setCurrent(data.consultation);
      await loadList();
      navigate(isExpert ? "/expert/consultations" : "/consultations");
    } catch (err) {
      setCloseError(extractApiError(err, "Clôture impossible.").message);
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6 mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
          <MessagesSquare className="w-8 h-8 text-primary" />
          {isExpert ? "Consultations investisseurs" : "Mes consultations"}
        </h1>
        <p className="text-muted-foreground">
          {isExpert
            ? "Demandes de consultation soumises par les investisseurs qualifiés."
            : "Vos demandes de consultation avec l'expert en analyse financière."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ minHeight: "600px" }}>
        {/* Left: Consultation list */}
        <div className="md:col-span-1 space-y-2">
          {loadingList ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : listError ? (
            <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {listError}
            </div>
          ) : consultations.length === 0 ? (
            <Card className="border-dashed">
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Aucune consultation pour le moment.</p>
              </div>
            </Card>
          ) : (
            consultations.map((c) => {
              const isActive = current?._id === c._id;
              return (
                <button
                  key={c._id}
                  type="button"
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 bg-card hover:bg-muted/40"
                  }`}
                  onClick={() => {
                    navigate(isExpert ? `/expert/consultations/${c._id}` : `/consultations/${c._id}`);
                    loadDetail(c._id);
                  }}
                >
                  <div className="flex justify-between items-start gap-1 mb-1">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {c.projectId?.title || "Projet"}
                    </span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{c.subject || "Consultation"}</div>
                  {isExpert && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <UserCircle className="w-3 h-3" /> {c.investorId?.email || "—"}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-2">
                    <span>{new Date(c.updatedAt).toLocaleDateString("fr-FR")}</span>
                    <span>·</span>
                    <span>{c.messages?.length || 0} msg(s)</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Consultation detail / chat */}
        <div className="md:col-span-2">
          {!id && !current ? (
            <Card className="border-dashed h-full flex flex-col items-center justify-center py-20 text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Sélectionnez une consultation dans la liste pour afficher les échanges.</p>
            </Card>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center h-full py-20">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : detailError ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" /> {detailError}
            </div>
          ) : current ? (
            <Card className="border-border/50 shadow-sm flex flex-col h-full" style={{ minHeight: "560px" }}>
              {/* Chat header */}
              <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h2 className="font-bold text-foreground">{current.projectId?.title || "Projet"}</h2>
                  <p className="text-sm text-muted-foreground">{current.subject}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <StatusBadge status={current.status} />
                    {isExpert && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <UserCircle className="w-3.5 h-3.5" /> {current.investorId?.email || "—"}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Investi : {Number(current.investedAmount || 0).toLocaleString("fr-FR")} TND
                    </span>
                  </div>
                </div>
                {current.status !== "CLOSED" && (
                  <Button variant="outline" size="sm" disabled={closing} onClick={closeConsultation} className="shrink-0">
                    {closing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCheck className="w-4 h-4 mr-2" />}
                    {closing ? "Clôture…" : "Clôturer"}
                  </Button>
                )}
              </div>

              {closeError && (
                <div className="mx-4 mt-3 bg-destructive/10 text-destructive text-xs p-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {closeError}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20" style={{ maxHeight: "360px" }}>
                {(current.messages || []).length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <BrainCircuit className="w-10 h-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {isExpert ? "Répondez à l'investisseur." : "En attente de réponse de l'expert."}
                    </p>
                  </div>
                )}
                {current.messages.map((m, i) => {
                  const isSelf =
                    (isExpert && m.senderRole === "EXPERT") ||
                    (!isExpert && m.senderRole === "INVESTOR");
                  return (
                    <div key={i} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isSelf ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"
                      }`}>
                        <div className={`text-[10px] font-semibold mb-1 ${isSelf ? "opacity-80" : "text-muted-foreground"}`}>
                          {m.senderRole === "EXPERT" ? "Expert" : "Investisseur"}
                          {" · "}
                          {new Date(m.createdAt).toLocaleString("fr-FR", { timeStyle: "short", dateStyle: "short" })}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="p-4 border-t border-border/40">
                {current.status !== "CLOSED" ? (
                  <>
                    {msgError && (
                      <div className="mb-2 bg-destructive/10 text-destructive text-xs p-2 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" /> {msgError}
                      </div>
                    )}
                    <div className="flex gap-2 items-end">
                      <Textarea
                        rows={2}
                        value={msgContent}
                        onChange={(e) => setMsgContent(e.target.value)}
                        disabled={sendingMsg}
                        placeholder="Votre message… (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
                        className="resize-none flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                        }}
                      />
                      <Button
                        disabled={sendingMsg || !msgContent.trim()}
                        onClick={sendMessage}
                        size="icon"
                        className="h-[72px] w-10 shrink-0"
                      >
                        {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm p-3 rounded-xl text-center">
                    Cette consultation est clôturée.
                    {current.closedAt && ` Fermée le ${new Date(current.closedAt).toLocaleDateString("fr-FR")}.`}
                  </div>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
