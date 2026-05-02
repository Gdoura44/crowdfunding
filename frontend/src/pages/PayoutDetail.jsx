import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import { payoutsApi } from "../api/payouts";
import { extractApiError } from "../utils/apiError";
import Guidance from "../components/ui/Guidance.jsx";
import Alert from "../components/ui/Alert.jsx";

function statusHelp(status) {
  if (status === "PENDING") return "Ajoutez vos coordonnées bancaires pour passer à l’étape suivante.";
  if (status === "READY") return "Coordonnées reçues. Un administrateur va valider le virement.";
  if (status === "PROCESSING") return "Virement initié. En attente de confirmation du prestataire.";
  if (status === "COMPLETED") return "Virement marqué comme complété.";
  if (status === "FAILED") return "Une erreur est survenue. Un administrateur va réessayer.";
  return "—";
}

export default function PayoutDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [payout, setPayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [ribOrIban, setRibOrIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");

  const canEdit = payout?.status === "PENDING";

  const bankDetailsJson = useMemo(() => {
    const normalized = String(ribOrIban || "").replace(/\s+/g, "").toUpperCase();
    const looksLikeIban = /^[A-Z]{2}/.test(normalized);
    return JSON.stringify({
      accountHolderName,
      bankName,
      ...(looksLikeIban ? { iban: normalized } : { rib: normalized }),
      swiftCode: swiftCode || undefined,
    });
  }, [accountHolderName, bankName, ribOrIban, swiftCode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const { data } = await payoutsApi.get(id);
        if (!cancelled) setPayout(data.payout);
      } catch (e) {
        if (!cancelled) {
          const out = extractApiError(e, "Impossible de charger ce payout.");
          setError(out.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOk("");
    try {
      await payoutsApi.provideBankDetails(id, bankDetailsJson);
      setOk("Coordonnées bancaires enregistrées.");
      const { data } = await payoutsApi.get(id);
      setPayout(data.payout);
    } catch (e2) {
      const out = extractApiError(e2, "Erreur lors de l’enregistrement.");
      setError(out.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Détails du payout"
        subtitle={payout ? statusHelp(payout.status) : "—"}
        actions={
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => nav(-1)}>
              Retour
            </button>
            <Link to="/payouts" className="btn btn-outline-secondary btn-sm">
              Mes payouts
            </Link>
          </div>
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}
      {ok && <Alert variant="success">{ok}</Alert>}
      {loading && <PageLoader label="Chargement…" />}

      {!loading && payout && (
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="card border-0 fc-surface-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">Résumé</div>
                  <span className="badge bg-light text-dark border">{payout.status}</span>
                </div>
                <div className="small text-muted">Projet</div>
                <div className="mb-2">
                  {payout.projectId && typeof payout.projectId === "object"
                    ? payout.projectId.title || String(payout.projectId._id || "—")
                    : String(payout.projectId || "—")}
                </div>
                <div className="small text-muted">Montant</div>
                <div className="fw-semibold">{payout.amount} TND</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-lg-7">
            <div className="card border-0 fc-surface-card">
              <div className="card-body">
                <div className="fw-semibold mb-2">Coordonnées bancaires</div>
                <div className="text-muted small mb-3">
                  Saisissez vos informations comme sur une plateforme de paiement : elles servent à initier le virement.
                  Les détails sont chiffrés côté serveur.
                </div>
                {canEdit && (
                  <Guidance title="Guidance" variant="info">
                    Utilisez les informations exactes de votre compte bancaire. Après l’envoi, la demande passe en
                    validation admin et vous ne pourrez plus modifier les champs tant que le statut n’est pas{" "}
                    <strong>PENDING</strong>.
                  </Guidance>
                )}

                {!canEdit && (
                  <Alert variant="info" className="mb-0">
                    Les coordonnées ne sont plus modifiables pour l’instant (statut: {payout.status}).
                  </Alert>
                )}

                {canEdit && (
                  <form onSubmit={submit} className="d-grid gap-2">
                    <div className="row g-2">
                      <div className="col-12">
                        <label className="form-label">Nom et prénom (titulaire du compte)</label>
                        <input
                          className="form-control"
                          value={accountHolderName}
                          onChange={(e) => setAccountHolderName(e.target.value)}
                          required
                          minLength={3}
                          placeholder="ex: Ahmed Ben Salah"
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Banque</label>
                        <select className="form-select" value={bankName} onChange={(e) => setBankName(e.target.value)} required>
                          <option value="">Choisir…</option>
                          <option value="BIAT">BIAT</option>
                          <option value="BNA">BNA</option>
                          <option value="STB">STB</option>
                          <option value="Amen Bank">Amen Bank</option>
                          <option value="ATB">ATB</option>
                          <option value="BH Bank">BH Bank</option>
                          <option value="BT">Banque de Tunisie (BT)</option>
                          <option value="UIB">UIB</option>
                          <option value="UBCI">UBCI</option>
                          <option value="Zitouna">Banque Zitouna</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                      <div className="col-12">
                        <label className="form-label">RIB / IBAN</label>
                        <input
                          className="form-control"
                          value={ribOrIban}
                          onChange={(e) => setRibOrIban(e.target.value)}
                          placeholder="RIB (20 chiffres) ou IBAN (ex: TN59...)"
                          required
                          inputMode="text"
                        />
                        <div className="form-text">
                          RIB: 20 chiffres (sans espaces). IBAN: commence par <strong>TN</strong>.
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label">Code SWIFT/BIC (optionnel)</label>
                        <input
                          className="form-control"
                          value={swiftCode}
                          onChange={(e) => setSwiftCode(e.target.value)}
                          placeholder="ex: ABCDTNTT (8 ou 11 caractères)"
                        />
                      </div>
                    </div>
                    <button className="btn btn-primary" disabled={saving}>
                      {saving ? "Envoi…" : "Confirmer et envoyer pour validation"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

