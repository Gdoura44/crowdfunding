import http from "./client";
import { paths } from "./paths";

export const payoutsApi = {
  mine: (params) => http.get(paths.payouts.mine, { params }),
  get: (id) => http.get(paths.payouts.byId(id)),
  provideBankDetails: (id, bankDetailsJsonString) =>
    http.put(paths.payouts.bankDetails(id), { bankDetails: bankDetailsJsonString }),
};

