import { useEffect, useState } from "react";
import { mediaUrl } from "../services/chatApi";

export function useMediaUrl(bucket, path) {
  const [state, setState] = useState({ path: "", url: "", error: false });

  useEffect(() => {
    if (!path) return;
    let active = true;
    async function refresh() {
      try {
        const url = await mediaUrl(bucket, path);
        if (active) setState({ path, url, error: false });
      } catch {
        if (active) setState({ path, url: "", error: true });
      }
    }
    refresh();
    const interval = setInterval(refresh, 45000);
    return () => { active = false; clearInterval(interval); };
  }, [bucket, path]);

  return state.path === path ? state : { url: "", error: false };
}
