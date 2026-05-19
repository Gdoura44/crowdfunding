import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoiceApi } from "../api/invoice";
import { extractApiError } from "../utils/apiError";
import { 
  Loader2, ArrowLeft, Printer, AlertTriangle, 
  Clock, BriefcaseBusiness, FileWarning
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [isCancellable, setIsCancellable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await invoiceApi.byId(id);
        setInvoice(data.invoice);
      } catch (err) {
        setError(extractApiError(err, "Impossible de charger la facture.").message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    // Ne jamais afficher le timer de grâce pour une consultation en attente —
    // la transaction n'est pas encore confirmée définitivement.
    const investmentStatus =
      invoice?.transactionDetails?.investmentStatus ||
      invoice?.transactionDetails?.status ||
      "";
    const isPending = investmentStatus === "PENDING_CONSULTATION";

    if (
      !invoice ||
      invoice.type !== "INVESTMENT" ||
      invoice.status === "REFUNDED" ||
      isPending  // ← Exclure explicitement le cas consultation en attente
    ) {
      setIsCancellable(false);
      return;
    }
    const graceMin = Number(invoice.transactionDetails?.cancellationGracePeriodMinutes || 5);
    const deadline = new Date(invoice.issuedAt).getTime() + graceMin * 60 * 1000;

    const interval = setInterval(() => {
      const leftMs = deadline - Date.now();
      if (leftMs <= 0) { setIsCancellable(false); clearInterval(interval); }
      else {
        setIsCancellable(true);
        const totalSecs = Math.max(1, Math.ceil(leftMs / 1000));
        const mm = Math.floor(totalSecs / 60);
        const ss = totalSecs % 60;
        setTimeLeftStr(`${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`);
      }
    }, 1000);

    const initialLeftMs = deadline - Date.now();
    if (initialLeftMs > 0) {
      setIsCancellable(true);
      const totalSecs = Math.max(1, Math.ceil(initialLeftMs / 1000));
      const mm = Math.floor(totalSecs / 60);
      const ss = totalSecs % 60;
      setTimeLeftStr(`${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`);
    } else { setIsCancellable(false); }

    return () => clearInterval(interval);
  }, [invoice]);

  const handlePrint = () => {
    if (isCancellable || invoice?.status === "REFUNDED") return;
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-muted-foreground font-medium">Chargement de la facture…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-12 space-y-4">
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  if (!invoice) return null;

  // Grace period — invoice not yet printable
  if (isCancellable) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
        <div className="max-w-lg w-full bg-card border border-border rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Facture en cours de sécurisation</h1>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Pour des raisons comptables et de lutte contre la fraude fiscale, la facture acquittée définitive
            ne peut être générée ou imprimée qu'après l'expiration de votre droit d'annulation de 5 minutes.
          </p>
          <div className="bg-muted/50 border border-border rounded-xl p-6 mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Disponible dans</p>
            <div className="text-5xl font-black text-primary font-mono tracking-wider">{timeLeftStr}</div>
          </div>
          <p className="text-muted-foreground text-xs mb-6">
            Vous pouvez toujours modifier ou annuler cet investissement depuis votre espace personnel durant ce délai.
          </p>
          <Button onClick={() => navigate("/investments")} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retourner à mes investissements
          </Button>
        </div>
      </div>
    );
  }

  // Pending expert consultation — must be checked BEFORE the grace-period gate
  // Use multiple fields as fallback since the API may return status on different paths
  const investmentStatus =
    invoice.transactionDetails?.investmentStatus ||
    invoice.transactionDetails?.status ||
    "";
  const isPendingConsultation = investmentStatus === "PENDING_CONSULTATION";
  if (isPendingConsultation) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-8 px-4">
        <div className="max-w-lg w-full bg-card border border-border rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <BriefcaseBusiness className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Facture en attente de validation</h1>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            Cet investissement nécessite une consultation experte réglementaire avant sa validation finale.
            La facture définitive ne pourra être émise et imprimée qu'après la confirmation définitive de votre investissement.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3 text-left">
            <FileWarning className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Statut de la transaction</p>
              <p className="text-xs text-blue-700">Paiement autorisé · En attente de consultation experte</p>
            </div>
          </div>
          <p className="text-muted-foreground text-xs mb-6">
            Veuillez finaliser votre consultation avec l'expert depuis votre espace personnel pour déverrouiller ce document.
          </p>
          <Button onClick={() => navigate("/investments")} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retourner à mes investissements
          </Button>
        </div>
      </div>
    );
  }

  const isInvestment = invoice.type === "INVESTMENT";
  const isRefunded = invoice.status === "REFUNDED";

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {/* Print styles (kept as inline for print-media compatibility) */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice {
            position: absolute; left: 0; top: 0; width: 100%;
            border: none !important; box-shadow: none !important;
            padding: 0 !important; margin: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}} />

      {/* Refund warning banner */}
      {isRefunded && (
        <div className="no-print mb-6 bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold mb-0.5">Facture Annulée &amp; Remboursée</h5>
            <p className="text-sm opacity-90">L'investissement correspondant a été annulé et remboursé. Ce document est légalement caduc. Son impression fiscale est strictement interdite.</p>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="no-print flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => navigate(isInvestment ? "/investments" : "/payouts")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {isInvestment ? "Mes investissements" : "Mes payouts"}
        </Button>
        {!isRefunded && (
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimer / Enregistrer PDF
          </Button>
        )}
      </div>

      {/* ── PRINTABLE INVOICE DOCUMENT ── */}
      <div id="printable-invoice" style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 10px 30px rgba(0,0,0,0.04)", padding: "2.5rem", maxWidth: "850px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2.2rem", height: "2.2rem", borderRadius: "6px", background: "linear-gradient(135deg, #0f4c5c, #1a8a9e)", color: "#fff", fontWeight: "bold", fontSize: "0.85rem" }}>FC</span>
              <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#111" }}>Fin<span style={{ fontWeight: 400, color: "#6b7280" }}>Collab</span></h1>
            </div>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280", lineHeight: "1.7" }}>
              <strong>Plateforme de Financement Collaboratif Agréée</strong><br />
              Capital Social : 100 000 TND · RNE : 1827463X<br />
              Matricule Fiscal : 1675849/A/M/000<br />
              Email : <span style={{ color: "#0f4c5c" }}>billing@fincollab.tn</span> · Tél : +216 71 800 900
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.05em" }}>
              {isInvestment ? "Facture d'Investissement" : "Facture de Versement"}
            </h2>
            <div style={{ fontSize: "0.82rem", color: "#111" }}>
              <div style={{ marginBottom: "0.25rem" }}><strong>N° Facture :</strong> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{invoice.invoiceNumber}</span></div>
              <div style={{ marginBottom: "0.25rem" }}><strong>Mode de règlement :</strong> <span style={{ padding: "0.1rem 0.4rem", border: "1px solid #e5e7eb", borderRadius: "4px", fontSize: "0.75rem" }}>FLOUCI · Carte Bancaire</span></div>
              <div>
                <strong>Statut fiscal :</strong>{" "}
                {isRefunded ? (
                  <span style={{ padding: "0.15rem 0.5rem", border: "1px solid #fca5a5", borderRadius: "4px", color: "#dc2626", fontWeight: 700, fontSize: "0.75rem", background: "#fef2f2" }}>ANNULÉE &amp; REMBOURSÉE</span>
                ) : (
                  <span style={{ padding: "0.15rem 0.5rem", border: "1px solid #86efac", borderRadius: "4px", color: "#15803d", fontWeight: 700, fontSize: "0.75rem", background: "#f0fdf4" }}>ACQUITTEE &amp; PAYEE</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Parties */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
          {[
            {
              title: isInvestment ? "Facturé à (Investisseur)" : "Bénéficiaire (Porteur de Projet)",
              content: !isInvestment && invoice.projectId?.isCompany ? (
                `Entreprise : ${invoice.projectId.companyName}\nMatricule Fiscal : ${invoice.projectId.companyMatricule}\nRNE : ${invoice.projectId.companyRNE}\nEmail du porteur : ${invoice.userId?.email || "—"}`
              ) : (
                `Nom complet : ${invoice.userId?.profile?.fullName || (invoice.userId?.profile?.firstName ? `${invoice.userId.profile.firstName} ${invoice.userId.profile.lastName}` : "") || invoice.userId?.email || "—"}\nEmail : ${invoice.userId?.email || "—"}\nTéléphone : ${invoice.userId?.profile?.phone || "Non renseigné"}`
              )
            },
            {
              title: "Détails de l'opération",
              content: `Projet soutenu : ${invoice.projectId?.title || "Soutien Projet"}\nType d'opération : ${isInvestment ? "Investissement participatif" : "Versement de fonds (Payout)"}\nID Transaction : ${invoice.referenceId}\nDate de valeur : ${new Date(invoice.issuedAt).toLocaleString("fr-FR")}`
            }
          ].map((box, idx) => (
            <div key={idx} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, color: "#6b7280", letterSpacing: "0.05em" }}>{box.title}</h3>
              <pre style={{ margin: 0, fontSize: "0.8rem", color: "#111", fontFamily: "inherit", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>{box.content}</pre>
            </div>
          ))}
        </div>

        {/* Items table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ background: "#111827", color: "#fff" }}>
              {["Description des prestations", "Taux TVA", "Montant HT", "Total TTC (TND)"].map((h, i) => (
                <th key={h} style={{ padding: "0.6rem 0.75rem", fontWeight: 600, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.04em", textAlign: i === 0 ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isInvestment ? (
              <>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "0.75rem", lineHeight: "1.5" }}>
                    <strong>Soutien participatif au projet "{invoice.projectId?.title}"</strong><br />
                    <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Prise de participation en financement collaboratif</span>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "#6b7280" }}>Exonéré</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{invoice.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                  <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 700 }}>{invoice.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.75rem", lineHeight: "1.5" }}>
                    <strong>Soutien volontaire à la plateforme FinCollab</strong><br />
                    <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Aide optionnelle pour le fonctionnement technique</span>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>19%</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{invoice.fee.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                  <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 700 }}>{(invoice.fee + invoice.tax).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                </tr>
              </>
            ) : (
              <>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "0.75rem", lineHeight: "1.5" }}>
                    <strong>Reversement de collecte — Projet "{invoice.projectId?.title}"</strong><br />
                    <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Versement des fonds collectés (Net de commission plateforme)</span>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right", color: "#6b7280" }}>Exonéré</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{invoice.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                  <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 700 }}>{invoice.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.75rem", lineHeight: "1.5" }}>
                    <strong>Commission d'intermédiation FinCollab</strong><br />
                    <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>Commission de services de la plateforme (5% HT + TVA)</span>
                  </td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>19%</td>
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>{invoice.fee.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                  <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 700 }}>{(invoice.fee + invoice.tax).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "2rem" }}>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1rem", minWidth: "280px" }}>
            <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ color: "#6b7280", padding: "0.2rem 0" }}>{isInvestment ? "Montant Investi (HT)" : "Financement Projet Net (HT)"} :</td><td style={{ textAlign: "right", fontWeight: 600, padding: "0.2rem 0" }}>{invoice.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td></tr>
                <tr><td style={{ color: "#6b7280", padding: "0.2rem 0" }}>{isInvestment ? "Soutien Plateforme HT" : "Commission Plateforme HT"} :</td><td style={{ textAlign: "right", fontWeight: 600, padding: "0.2rem 0" }}>{invoice.fee.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td></tr>
                <tr><td style={{ color: "#6b7280", padding: "0.2rem 0" }}>TVA collectée (19%) :</td><td style={{ textAlign: "right", fontWeight: 600, padding: "0.2rem 0" }}>{invoice.tax.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td></tr>
                <tr style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={{ fontWeight: 800, color: "#111", paddingTop: "0.5rem", fontSize: "0.9rem" }}>{isInvestment ? "Total Débité (TTC)" : "Total Collecté (TTC)"} :</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#0f4c5c", paddingTop: "0.5rem", fontSize: "0.9rem" }}>{invoice.total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "1.5rem 0" }} />

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "2rem" }}>
          <div style={{ flex: 1, fontSize: "0.75rem", color: "#6b7280", lineHeight: "1.7" }}>
            <h4 style={{ margin: "0 0 0.4rem", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, color: "#111", letterSpacing: "0.04em" }}>Mentions Légales &amp; Règlement</h4>
            <p style={{ margin: 0 }}>
              Cette facture tient lieu de preuve de versement et reçu libératoire. Les fonds sont sécurisés conformément aux directives de la réglementation sur le Crowdfunding en Tunisie.<br />
              <strong>Banque partenaire :</strong> Banque Internationale Arabe de Tunisie (BIAT)<br />
              <strong>RIB séquestre FinCollab :</strong> TN59 0800 0000 1234 5678 9012 · <strong>Code SWIFT :</strong> BIATNTTXXXX
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            {isRefunded ? (
              <div style={{ border: "2px dashed #dc2626", borderRadius: "8px", padding: "0.75rem 1rem", color: "#dc2626", textTransform: "uppercase", fontWeight: 700, transform: "rotate(-4deg)", minWidth: "140px", lineHeight: "1.4" }}>
                ✕<br />Facture Annulée<br /><span style={{ fontSize: "0.6rem" }}>&amp; REMBOURSÉE</span>
              </div>
            ) : (
              <div style={{ border: "2px dashed #15803d", borderRadius: "8px", padding: "0.75rem 1rem", color: "#15803d", textTransform: "uppercase", fontWeight: 700, transform: "rotate(-4deg)", minWidth: "140px", lineHeight: "1.4" }}>
                ✓<br />FinCollab<br /><span style={{ fontSize: "0.6rem" }}>FACTURE ACQUITTEE</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
