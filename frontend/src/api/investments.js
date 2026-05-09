import http from "./client";
import { paths } from "./paths";

export const investmentsApi = {
  create: (body) => http.post(paths.investments.create, body),
  mine: (params) => http.get(paths.investments.mine, { params }),
  cancel: (id) => http.post(paths.investments.cancel(id)),
  retry: (id) => http.post(paths.investments.retry(id)),
  mockConfirm: (body, config) => http.post(paths.investments.mockConfirm, body, config),
  mockSendOtp: (body, config) => http.post(paths.investments.mockSendOtp, body, config),
};

