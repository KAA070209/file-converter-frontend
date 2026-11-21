"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 20 * 1024 * 1024;
type Mode = "image" | "pdf";
type Job = { id: string; operation: string; status: string; created_at: string; download_url: string | null };

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const shared = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M20 16.5v2A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-2"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5m-5 5V3"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
  };
  return <svg {...shared}>{paths[name] || paths.file}</svg>;
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function extension(file: File) { return file.name.split(".").pop()?.toUpperCase() || "FILE"; }
function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
function responseFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const name = encoded || plain;
  if (!name) return fallback;
  try { return decodeURIComponent(name); } catch { return name; }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("image");
  const [output, setOutput] = useState("png");
  const [quality, setQuality] = useState(90);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState<Job[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  useEffect(() => {
    let active = true;
    fetch(`${API}/api/v1/jobs?limit=5`).then(async (response) => {
      if (!response.ok) throw new Error("Riwayat tidak tersedia");
      return response.json();
    }).then((data) => { if (active) setHistory(data.items || []); }).catch(() => { if (active) setHistoryError(true); });
    return () => { active = false; };
  }, []);

  function addFiles(selected: FileList | File[]) {
    setError(""); setSuccess("");
    const valid: File[] = [];
    for (const file of Array.from(selected)) {
      if (!ACCEPTED.includes(file.type)) { setError(`${file.name}: format yang didukung hanya JPG, PNG, dan WEBP.`); continue; }
      if (file.size > MAX_SIZE) { setError(`${file.name}: ukuran maksimal 20 MB per file.`); continue; }
      valid.push(file);
    }
    if (valid.length) setFiles((current) => [...current, ...valid].slice(0, mode === "pdf" ? 30 : 1));
  }
  function onInput(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }
  function switchMode(value: Mode) { setMode(value); setFiles([]); setError(""); setSuccess(""); }
  function removeFile(index: number) { setFiles((current) => current.filter((_, i) => i !== index)); }

  async function convert() {
    if (!files.length || busy) return;
    setBusy(true); setError(""); setSuccess("");
    const form = new FormData();
    let url: string;
    if (mode === "image") {
      form.append("file", files[0]);
      url = `${API}/api/v1/convert/image?output_format=${output}&quality=${quality}&background=white`;
    } else {
      files.forEach((file) => form.append("files", file));
      if (files.length > 1) {
        url = `${API}/api/v1/convert/images-to-pdf`;
      } else {
        const endpoint = files[0].type === "image/jpeg" ? "jpg-to-pdf" : "png-to-pdf";
        url = `${API}/api/v1/convert/${endpoint}`;
        // Endpoint single-image menggunakan field multipart `file`, sedangkan
        // endpoint penggabungan memakai field `files` berulang.
        form.delete("files");
        form.append("file", files[0]);
      }
    }
    try {
      const response = await fetch(url, { method: "POST", body: form });
      if (!response.ok) {
        let message = "Konversi gagal. Silakan coba lagi.";
        try { const payload = await response.json(); message = payload.detail || message; } catch { /* keep fallback */ }
        throw new Error(response.status === 429 ? "Batas konversi tercapai. Tunggu sebentar lalu coba lagi." : message);
      }
      const blob = await response.blob();
      const filename = mode === "pdf" ? "hasil-konversi.pdf" : `hasil-konversi.${output === "jpeg" ? "jpg" : output}`;
      downloadBlob(blob, responseFilename(response, filename));
      const jobId = response.headers.get("X-Job-ID");
      let jobStatus = "";
      if (jobId) {
        const jobResponse = await fetch(`${API}/api/v1/jobs/${jobId}`);
        if (jobResponse.ok) {
          const job: Job = await jobResponse.json();
          jobStatus = job.status === "completed" ? " Status: selesai." : ` Status: ${job.status}.`;
        }
      }
      setSuccess(jobId ? `Selesai! File berhasil diunduh. ID konversi: ${jobId.slice(0, 8)}…${jobStatus}` : "Selesai! File berhasil diunduh.");
      const jobsResponse = await fetch(`${API}/api/v1/jobs?limit=5`);
      if (jobsResponse.ok) { const data = await jobsResponse.json(); setHistory(data.items || []); setHistoryError(false); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Terjadi kesalahan saat menghubungi server."); }
    finally { setBusy(false); }
  }

  async function downloadAgain(job: Job) {
    if (!job.download_url) return;
    try {
      const response = await fetch(`${API}${job.download_url}`);
      if (!response.ok) throw new Error("File hasil sudah tidak tersedia.");
      const fallback = job.operation.includes("pdf") ? "hasil-konversi.pdf" : "hasil-konversi";
      downloadBlob(await response.blob(), responseFilename(response, fallback));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unduhan gagal."); }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark"><Icon name="sparkle" size={22} /></span><span>konversi<span className="brand-dot">.</span></span></a>
        <div className="side-caption">RUANG KERJA</div>
        <nav className="nav-list">
          <a className="nav-item active" href="#converter"><Icon name="image" size={19} /><span>Konverter</span><span className="nav-arrow">›</span></a>
          <a className="nav-item" href="#history"><Icon name="clock" size={19} /><span>Riwayat</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-caption">BUTUH BANTUAN?</div>
          <div className="help-card"><div className="help-icon"><Icon name="sparkle" size={17} /></div><strong>Konversi lebih mudah.</strong><p>Pilih format, unggah file, dan biarkan kami mengurus sisanya.</p><a href="#converter">Mulai sekarang <Icon name="arrow" size={13} /></a></div>
          <div className="user-mini"><div className="avatar">K</div><div><strong>Pengguna</strong><span>Ruang kerja pribadi</span></div><span className="user-menu">···</span></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div className="breadcrumb">Ruang kerja <span>/</span> <strong>Konverter</strong></div><div className="top-actions"><span className="secure-label"><Icon name="shield" size={15} /> File kamu aman</span><span className="top-divider"/><div className="top-avatar">K</div></div></header>

        <div className="content" id="converter">
          <div className="hero-row"><div><div className="eyebrow"><span className="eyebrow-sparkle"><Icon name="sparkle" size={13} /></span> KONVERSI FILE TANPA RIBET</div><h1>Setiap format,<br/><span>satu tempat.</span></h1><p className="hero-copy">Ubah gambar ke format yang kamu butuhkan. Cepat, simpel, dan tetap tajam.</p></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-card card-back">JPG</div><div className="art-card card-mid">PNG</div><div className="art-card card-front"><Icon name="sparkle" size={25}/><small>siap!</small></div><div className="art-spark spark-a">✳</div><div className="art-spark spark-b">✦</div></div></div>

          <section className="converter-card">
            <div className="card-heading"><div><h2>Mulai konversi</h2><p>Pilih jenis konversi dan unggah file kamu.</p></div><div className="step-pill"><span>01</span> Pilih & konversi</div></div>
            <div className="mode-switch" role="tablist" aria-label="Jenis konversi">
              <button className={`mode-option ${mode === "image" ? "selected" : ""}`} onClick={() => switchMode("image")} role="tab" aria-selected={mode === "image"}><span className="mode-icon image-mode"><Icon name="image" size={18}/></span><span><strong>Gambar ke gambar</strong><small>JPG, PNG, WEBP</small></span>{mode === "image" && <span className="radio-dot"/>}</button>
              <button className={`mode-option ${mode === "pdf" ? "selected" : ""}`} onClick={() => switchMode("pdf")} role="tab" aria-selected={mode === "pdf"}><span className="mode-icon pdf-mode"><Icon name="file" size={18}/></span><span><strong>Gambar ke PDF</strong><small>Gabungkan hingga 30 gambar</small></span>{mode === "pdf" && <span className="radio-dot"/>}</button>
            </div>

            {mode === "image" && <div className="format-controls"><div className="control-label">FORMAT KELUARAN</div><div className="format-row"><div className="format-chips">{["png", "jpg", "webp"].map((format) => <button key={format} className={`format-chip ${output === format ? "chosen" : ""}`} onClick={() => setOutput(format)}>{format.toUpperCase()}{output === format && <span className="chip-check"><Icon name="check" size={11}/></span>}</button>)}</div><div className="quality-control"><span>Kualitas</span><input aria-label="Kualitas gambar" type="range" min="1" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))}/><strong>{quality}%</strong></div></div></div>}

            <div className={`dropzone ${dragging ? "dragging" : ""} ${files.length ? "has-files" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple={mode === "pdf"} onChange={onInput} hidden/>
              {files.length === 0 ? <><div className="upload-icon"><Icon name="upload" size={23}/></div><div className="drop-title">Tarik file ke sini, atau <button className="browse-button" onClick={() => inputRef.current?.click()}>pilih file</button></div><p>JPG, PNG, atau WEBP <span>·</span> Maks. 20 MB per file{mode === "pdf" && <><span> · </span>hingga 30 file</>}</p></> : <div className="file-list">{files.map((file, index) => <div className="file-row" key={`${file.name}-${index}`}><div className={`file-type ${extension(file) === "PDF" ? "pdf-type" : ""}`}>{extension(file).slice(0, 4)}</div><div className="file-info"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span></div><span className="file-ready"><Icon name="check" size={14}/> Siap</span><button className="remove-file" aria-label={`Hapus ${file.name}`} onClick={() => removeFile(index)}><Icon name="close" size={17}/></button></div>)}{mode === "pdf" && files.length < 30 && <button className="add-more" onClick={() => inputRef.current?.click()}><Icon name="plus" size={15}/> Tambah gambar</button>}</div>}
            </div>
            <div className="upload-foot"><span><Icon name="shield" size={14}/> File diproses dengan aman</span>{files.length > 0 && <span>{files.length} file <i>·</i> {formatBytes(totalSize)}</span>}</div>
            {error && <div className="feedback error-feedback" role="alert">{error}</div>}{success && <div className="feedback success-feedback"><Icon name="check" size={16}/>{success}</div>}
            <button className="convert-button" onClick={convert} disabled={!files.length || busy}>{busy ? <><span className="spinner"/> Sedang mengonversi…</> : <><Icon name="sparkle" size={17}/> Konversi sekarang <Icon name="arrow" size={16}/></>}</button>
            <div className="card-note">{mode === "image" ? `Format ${output.toUpperCase()} · Kualitas ${quality}%` : `${files.length || 0} halaman · Satu PDF`} <span>·</span> Gratis, tanpa watermark</div>
          </section>

          <section className="history-section" id="history"><div className="section-heading"><div><div className="section-kicker">AKTIVITAS TERBARU</div><h2>Riwayat konversi</h2></div><span className="live-dot" title="Riwayat tersambung"/></div>
            {history.length ? <div className="history-list">{history.map((job) => <div className="history-item" key={job.id}><span className={`history-file-icon ${job.operation.includes("pdf") ? "history-pdf" : "history-img"}`}><Icon name={job.operation.includes("pdf") ? "file" : "image"} size={18}/></span><div className="history-info"><strong>{job.operation === "images-to-pdf" || job.operation === "image-to-pdf" ? "Gambar ke PDF" : "Konversi gambar"}</strong><span>{new Date(job.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} <i>·</i> ID {job.id.slice(0, 8)}</span></div><span className={`status ${job.status === "completed" ? "status-done" : "status-other"}`}><span/> {job.status === "completed" ? "Selesai" : job.status === "failed" ? "Gagal" : "Diproses"}</span>{job.status === "completed" && job.download_url && <button className="history-download" onClick={() => downloadAgain(job)} aria-label="Unduh hasil lagi"><Icon name="download" size={16}/></button>}</div>)}</div> : <div className="empty-history"><span><Icon name="clock" size={19}/></span><div><strong>{historyError ? "Riwayat belum tersambung" : "Belum ada konversi"}</strong><p>{historyError ? "Pastikan backend aktif di localhost:8000." : "Hasil konversi kamu akan muncul di sini."}</p></div></div>}
          </section>
          <footer className="footer"><span>© 2026 Konversi</span><span>Format gambar favoritmu, kini lebih mudah.</span><a href={`${API}/docs`} target="_blank" rel="noreferrer">Dokumentasi API <Icon name="arrow" size={12}/></a></footer>
        </div>
      </section>
    </main>
  );
}
