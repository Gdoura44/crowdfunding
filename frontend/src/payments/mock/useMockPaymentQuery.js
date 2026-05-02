import { useLocation } from "react-router-dom";
import { useMemo } from "react";

/**
 * Paramètres de la page « prestataire » mock : alignés sur mockPaymentProvider (backend).
 */
export function useMockPaymentQuery() {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  return useMemo(
    () => ({
      providerPaymentId: params.get("paymentId") || "",
      ref: params.get("ref") || "",
      amount: params.get("amount") || "",
      currency: params.get("currency") || "TND",
    }),
    [params]
  );
}
