import http from "./client";
import { paths } from "./paths";

export const chatbotApi = {
  askAboutProject: (projectId, question) =>
    http.post(paths.chatbot.askProject(projectId), { question }),
};

