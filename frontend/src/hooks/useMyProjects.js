import { useCallback, useEffect, useRef, useState } from "react";
import { projectsApi } from "../api/projects";
import { extractApiError } from "../utils/apiError";

export function useMyProjects({ enabled = true } = {}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");
  const loadSeq = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++loadSeq.current;
    setError("");
    setLoading(true);
    try {
      const { data } = await projectsApi.mine();
      if (seq !== loadSeq.current) return;
      setProjects(data.projects || []);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      const out = extractApiError(e, "Impossible de charger vos projets.");
      setError(out.message);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
  }, [enabled, reload]);

  const deleteProject = useCallback(
    async (projectId) => {
      // Optimistic UI: remove immediately.
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      try {
        await projectsApi.remove(projectId);
      } catch (e) {
        // Recharger depuis le serveur pour éviter une UI incohérente après échec.
        await reload();
        throw e;
      }
      // Garantir la synchronisation (couvre les cas où le backend refuse la suppression).
      await reload();
    },
    [reload]
  );

  return {
    projects,
    setProjects,
    loading,
    error,
    reload,
    deleteProject,
  };
}

