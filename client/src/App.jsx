import { useEffect, useRef, useState } from "react";

const MAX_SIDE = 2048;
const QUALITY = 0.92;

const fmt = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", QUALITY));
  return { blob, w, h };
}

const svg = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const Icon = {
  upload: <svg {...svg}><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>,
  check: <svg {...svg}><path d="m5 12.5 4.5 4.5L19 7" /></svg>,
  alert: <svg {...svg}><path d="M12 8.5v5M12 17v.01" /><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>,
};

function Copy({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  const click = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" className="ghost" onClick={click}>
      {done ? "Copied" : label}
    </button>
  );
}

function Head({ title, children }) {
  return (
    <div className="head">
      <h2>{title}</h2>
      <div className="head-actions">{children}</div>
    </div>
  );
}

function Result({ data }) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <>
      <Head title="Extracted text"><Copy text={text} /></Head>
      <pre className="mono">{text || "No text found in this image."}</pre>
      <p className="note">{words} words, {text.length} characters</p>
    </>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" aria-label="Analyzing image">
      <i style={{ width: "38%" }} />
      <i style={{ width: "100%" }} />
      <i style={{ width: "92%" }} />
      <i style={{ width: "96%" }} />
      <i style={{ width: "61%" }} />
    </div>
  );
}

export default function App() {
  const inputRef = useRef(null);
  const [img, setImg] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);

  const load = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn’t an image. Choose a JPG, PNG, WebP or GIF.");
      return;
    }
    setError("");
    setData(null);
    try {
      const s = await shrink(file);
      const url = URL.createObjectURL(s.blob);
      setImg((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { ...s, url, name: file.name || "Pasted image", before: file.size };
      });
    } catch {
      setError("This image couldn’t be read. Try saving it as a JPG or PNG.");
    }
  };

  useEffect(() => {
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
      if (f) load(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const clear = () => {
    if (img) URL.revokeObjectURL(img.url);
    setImg(null);
    setData(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const run = async () => {
    if (!img || loading) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const form = new FormData();
      form.append("image", img.blob, "image.jpg");
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "The request failed. Check that the server is running.");
      setData(json.result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const open = () => inputRef.current?.click();

  return (
    <div className="shell">
      <header>
        <h1>Text Extractor (OCR)</h1>
        <p>Upload a screenshot, receipt or document and get the text.</p>
      </header>

      <div className="grid">
        <section className="panel input-panel" aria-label="Image">
          <div
            className={"drop" + (drag ? " over" : "") + (img ? " has" : "")}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); load(e.dataTransfer.files[0]); }}
          >
            {img ? (
              <img src={img.url} alt="Your uploaded image" />
            ) : (
              <div
                className="empty"
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
              >
                {Icon.upload}
                <strong>Drop an image here</strong>
                <span>or click to browse. You can also paste one with Ctrl+V.</span>
                <small>JPG, PNG, WebP or GIF</small>
              </div>
            )}
          </div>

          {img && (
            <div className="file-row">
              <div className="file-info">
                <span className="name" title={img.name}>{img.name}</span>
                <span className="meta">{img.w}×{img.h}px, sent as {fmt(img.blob.size)} (original {fmt(img.before)})</span>
              </div>
              <div className="head-actions">
                <button type="button" className="ghost" onClick={open}>Replace</button>
                <button type="button" className="ghost" onClick={clear}>Remove</button>
              </div>
            </div>
          )}

          <button type="button" className="primary" disabled={!img || loading} onClick={run}>
            {loading ? "Working…" : "Extract text"}
          </button>
        </section>

        <section className="panel result" aria-live="polite" aria-busy={loading}>
          {loading ? (
            <Skeleton />
          ) : error ? (
            <div className="error" role="alert">
              {Icon.alert}
              <div>
                <h2>Something went wrong</h2>
                <p>{error}</p>
              </div>
            </div>
          ) : data ? (
            <Result data={data} />
          ) : (
            <div className="placeholder">
              <h2>Extracted text</h2>
              <p>Add a screenshot, receipt or scanned page. The text appears here, ready to copy.</p>
            </div>
          )}
        </section>
      </div>

      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { load(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}
