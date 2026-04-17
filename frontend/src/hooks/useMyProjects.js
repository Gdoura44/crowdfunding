import { useCallback, useEffect, useRef, useState } from "react";
import { projectsApi } from "../api/projects";

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
      setError(e?.response?.data?.message || "Impossible de charger vos projets.");
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
        // Restore by reloading from server to avoid inconsistent UI.
        await reload();
        throw e;
      }
      // Ensure we're synced (covers edge cases where backend blocks deletion).
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

