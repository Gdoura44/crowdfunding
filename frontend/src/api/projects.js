import http from "./client";
import { paths } from "./paths";

/** Appels API projets (CRUD / workflow) utilisés par le tableau de bord créateur. */
export const projectsApi = {
  mine: () => http.get(paths.projects.mine),
  create: (body) => http.post(paths.projects.collection, body),
  public: (params) => http.get(paths.projects.public, { params }),
  search: (params) => http.get(paths.projects.search, { params }),
  byId: (id) => http.get(paths.projects.byId(id)),
  listComments: (id) => http.get(paths.projects.comments(id)),
  createComment: (id, body) => http.post(paths.projects.comments(id), body),
  deleteComment: (projectId, commentId) =>
    http.delete(paths.projects.deleteComment(projectId, commentId)),
  edit: (id) => http.get(paths.projects.edit(id)),
  update: (id, body) => http.put(paths.projects.update(id), body),
  resubmit: (id, body) => http.put(paths.projects.resubmit(id), body),
  archive: (id) => http.post(paths.projects.archive(id)),
  submitForAi: (id) => http.post(paths.projects.submitForAi(id)),
  remove: (id) => http.delete(paths.projects.delete(id)),
};
