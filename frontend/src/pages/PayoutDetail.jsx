import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import { payoutsApi } from "../api/payouts";
import { extractApiError } from "../utils/apiError";
import Guidance from "../components/ui/Guidance.jsx";

function statusHelp(status) {
  if (status === "PENDING") return "Ajoutez vos coordonnées bancaires pour passer à l’étape suivante.";
  if (status === "READY") return "Coordonnées reçues. Un administrateur va valider le virement.";
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
  const [iban, setIban] = useState("");
  const [swiftCode, setSwiftCode] = useState("");

  const canEdit = payout?.status === "PENDING";

  const bankDetailsJson = useMemo(() => {
    return JSON.stringify({
      accountHolderName,
      bankName,
      iban,
      swiftCode: swiftCode || undefined,
    });
  }, [accountHolderName, bankName, iban, swiftCode]);

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

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {ok && <div className="alert alert-success py-2">{ok}</div>}
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
                <div className="small text-muted">ProjectId</div>
                <div className="mb-2">{String(payout.projectId)}</div>
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
                  Vos coordonnées sont collectées pour initier le virement. Les détails sont chiffrés côté serveur.
                </div>
                {canEdit && (
                  <Guidance title="Guidance" variant="info">
                    Remplissez des informations exactes. Après l’envoi, la demande passe en validation admin et
                    vous ne pourrez plus modifier les champs tant que le statut n’est pas <strong>PENDING</strong>.
                  </Guidance>
                )}

                {!canEdit && (
                  <div className="alert alert-info py-2 mb-0">
                    Les coordonnées ne sont plus modifiables pour l’instant (statut: {payout.status}).
                  </div>
                )}

                {canEdit && (
                  <form onSubmit={submit} className="d-grid gap-2">
                    <div className="row g-2">
                      <div className="col-12">
                        <label className="form-label">Nom du titulaire</label>
                        <input
                          className="form-control"
                          value={accountHolderName}
                          onChange={(e) => setAccountHolderName(e.target.value)}
                          required
                          minLength={3}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Banque</label>
                        <input
                          className="form-control"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          required
                          minLength={3}
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">IBAN</label>
                        <input
                          className="form-control"
                          value={iban}
                          onChange={(e) => setIban(e.target.value)}
                          placeholder="ex: TN59..."
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">SWIFT (optionnel)</label>
                        <input
                          className="form-control"
                          value={swiftCode}
                          onChange={(e) => setSwiftCode(e.target.value)}
                          placeholder="8 ou 11 caractères"
                        />
                      </div>
                    </div>
                    <button className="btn btn-primary" disabled={saving}>
                      {saving ? "Enregistrement…" : "Enregistrer et envoyer pour validation"}
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

