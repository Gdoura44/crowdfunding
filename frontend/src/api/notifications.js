import http from "./client";
import { paths } from "./paths";

export const notificationsApi = {
  list: (params) => http.get(paths.notifications.list, { params }),
  markRead: (id) => http.patch(paths.notifications.markRead(id)),
};

