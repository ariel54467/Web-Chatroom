import { useEffect, useState } from "react";
import { Search, Upload } from "lucide-react";
import { Modal, Status, Busy } from "./ui";

export function GifPicker({ onClose, onChoose, onUpload }) {
  const key = import.meta.env.VITE_GIPHY_API_KEY;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true); setError("");
      try {
        const params = new URLSearchParams({ api_key: key, limit: "12", rating: "g" });
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`https://api.giphy.com/v1/gifs/${query.trim() ? "search" : "trending"}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("GIF search is temporarily unavailable.");
        setResults((await response.json()).data);
      } catch (e) { if (e.name !== "AbortError") setError(e.message); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, query]);
  function select(gif) {
    onChoose({
      url: gif.images.fixed_height.url,
      preview: gif.images.fixed_height_small.url,
      title: gif.title || "GIF",
    });
  }
  return <Modal title="GIFs" onClose={onClose}>
    <button className="button secondary" onClick={onUpload}><Upload size={17} />Upload a GIF</button>
    {key && <>
      <label className="search-field"><Search size={18} /><input autoFocus aria-label="Search GIFs" placeholder="Search GIFs" value={query} maxLength={50} onChange={e => setQuery(e.target.value)} /></label>
      {busy && <Busy />}{error && <Status error>{error}</Status>}
      <div className="gif-results">{results.map(gif => <button className="image-button" key={gif.id} onClick={() => select(gif)} aria-label={gif.title || "Choose GIF"}>
        <img src={gif.images.fixed_height_small.url} alt={gif.title || "GIF"} loading="lazy" />
      </button>)}</div>
      <p className="provider-credit">Powered by GIPHY</p>
    </>}
  </Modal>;
}
