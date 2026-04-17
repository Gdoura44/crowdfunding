import http from "./client";
import { paths } from "./paths";

export const recommendationsApi = {
  list: (params) => http.get(paths.recommendations.list, { params }),
};

