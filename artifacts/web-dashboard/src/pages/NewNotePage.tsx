import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import Icon from '../components/common/Icon';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import Spinner from '../components/common/Spinner';
import { graphData } from '../shared/pageCache';

type Tab = 'text' | 'image' | 'batch';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NewNotePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('text');

  // Text tab state
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [userNote, setUserNote] = useState('');

  // Image tab state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imgSourceUrl, setImgSourceUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch tab state
  const [batchEntries, setBatchEntries] = useState<string[]>(['', '']);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  // Shared state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) { setError('請選擇圖片檔案'); return; }
    setImageFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  async function handleSubmitText() {
    if (!sourceText.trim()) { setError('請輸入文字內容'); return; }
    setLoading(true); setError('');
    try {
      await api.notes.createText({ sourceText, sourceUrl: sourceUrl || undefined, userNote: userNote || undefined });
      graphData.invalidate();
      navigate('/timeline');
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitBatch() {
    const valid = batchEntries.filter((t) => t.trim());
    if (!valid.length) { setError('請至少輸入一篇內容'); return; }
    setLoading(true); setError('');
    setBatchProgress({ done: 0, total: valid.length });
    try {
      await Promise.all(valid.map(async (text) => {
        await api.notes.createText({ sourceText: text });
        setBatchProgress((p) => p ? { ...p, done: p.done + 1 } : null);
      }));
      graphData.invalidate();
      navigate('/timeline');
    } catch (err) {
      setError(err instanceof Error ? err.message : '部分筆記建立失敗');
    } finally {
      setLoading(false);
      setBatchProgress(null);
    }
  }

  async function handleSubmitImage() {
    if (!imageFile) { setError('請選擇圖片'); return; }
    setLoading(true); setError('');
    try {
      const base64 = await fileToBase64(imageFile);
      await api.notes.createImage({ imageBase64: base64, sourceUrl: imgSourceUrl || undefined, sourceTitle: imageFile.name });
      graphData.invalidate();
      navigate('/timeline');
    } catch (err) {
      setError(err instanceof Error ? err.message : '上傳失敗');
    } finally {
      setLoading(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 0',
    border: 'none',
    borderRadius: 'var(--radius-input)',
    fontSize: 'var(--font-base)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 150ms',
    background: active ? 'var(--color-signal)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-lo)',
  });

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-text-hi)' }}>
        <Icon name="pencil" size={18} style={{ display: 'inline', marginRight: 8 }} /> 新增筆記
      </h1>

      {/* Tab selector */}
      <div style={{
        display: 'flex',
        background: 'var(--color-surf-2)',
        borderRadius: 'var(--radius-input)',
        padding: 4,
        gap: 4,
      }}>
        <button style={tabStyle(tab === 'text')} onClick={() => { setTab('text'); setError(''); }}>
          <Icon name="pencil" size={13} style={{ display: 'inline', marginRight: 4 }} /> 輸入文字
        </button>
        <button style={tabStyle(tab === 'image')} onClick={() => { setTab('image'); setError(''); }}>
          <Icon name="image" size={13} style={{ display: 'inline', marginRight: 4 }} /> 上傳圖片
        </button>
        <button style={tabStyle(tab === 'batch')} onClick={() => { setTab('batch'); setError(''); }}>
          <Icon name="clipboard" size={13} style={{ display: 'inline', marginRight: 4 }} /> 批次輸入
        </button>
      </div>

      {/* ── 文字輸入 ── */}
      {tab === 'text' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-mid)', marginBottom: 6, fontWeight: 600 }}>
              文字內容 <span style={{ color: 'var(--color-failed)' }}>*</span>
            </label>
            <textarea
              className="input-field"
              style={{ minHeight: 200, resize: 'vertical', lineHeight: 1.8 }}
              placeholder="貼上文章、筆記、想法...&#10;&#10;AI 會自動生成標題、摘要和標籤"
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              autoFocus
            />
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text-lo)', marginTop: 4, textAlign: 'right' }}>
              {sourceText.length} 字
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-mid)', marginBottom: 6, fontWeight: 600 }}>
              來源網址（選填）
            </label>
            <input
              className="input-field"
              type="url"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-mid)', marginBottom: 6, fontWeight: 600 }}>
              個人備注（選填）
            </label>
            <textarea
              className="input-field"
              style={{ minHeight: 80, resize: 'vertical' }}
              placeholder="你的想法或備注..."
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
            />
          </div>

          {error && <div style={{ color: 'var(--color-failed)', fontSize: 'var(--font-sm)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmitText} disabled={loading}>
              {loading ? <Spinner size={16} color="#fff" /> : <><Icon name="sparkle" size={13} /> 送出並讓 AI 處理</>}
            </button>
            <button className="btn-ghost" onClick={() => navigate(-1)} disabled={loading}>取消</button>
          </div>
        </div>
      )}

      {/* ── 批次輸入 ── */}
      {tab === 'batch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-lo)' }}>
            每個輸入框為一篇筆記，送出後同時交給 AI 處理
          </div>
          {batchEntries.map((text, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-lo)', paddingTop: 10, minWidth: 24, textAlign: 'right' }}>
                {i + 1}.
              </span>
              <textarea
                className="input-field"
                style={{ flex: 1, minHeight: 100, resize: 'vertical' }}
                placeholder={`第 ${i + 1} 篇內容...`}
                value={text}
                onChange={(e) => {
                  const next = [...batchEntries];
                  next[i] = e.target.value;
                  setBatchEntries(next);
                }}
              />
              {batchEntries.length > 1 && (
                <button
                  className="btn-ghost"
                  style={{ padding: '6px 10px', marginTop: 4, flexShrink: 0 }}
                  onClick={() => setBatchEntries(batchEntries.filter((_, j) => j !== i))}
                >
                  <Icon name="close" size={11} />
                </button>
              )}
            </div>
          ))}

          <button
            className="btn-ghost"
            style={{ alignSelf: 'flex-start', fontSize: 'var(--font-sm)' }}
            onClick={() => setBatchEntries([...batchEntries, ''])}
          >
            + 新增一篇
          </button>

          {batchProgress && (
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-done)', fontWeight: 600 }}>
              處理中 {batchProgress.done} / {batchProgress.total} 篇...
            </div>
          )}

          {error && <div style={{ color: 'var(--color-failed)', fontSize: 'var(--font-sm)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmitBatch} disabled={loading}>
              {loading ? <Spinner size={16} color="#fff" /> : <><Icon name="sparkle" size={13} /> {`送出 ${batchEntries.filter(t => t.trim()).length} 篇`}</>}
            </button>
            <button className="btn-ghost" onClick={() => navigate(-1)} disabled={loading}>取消</button>
          </div>
        </div>
      )}

      {/* ── 圖片上傳 ── */}
      {tab === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Drop zone */}
          {!imagePreview ? (
            <div
              className={`drop-zone${dragOver ? ' drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ marginBottom: 12, color: 'var(--color-text-lo)', opacity: 0.5 }}><Icon name="image" size={40} /></div>
              <div style={{ fontSize: 'var(--font-md)', fontWeight: 600, marginBottom: 6 }}>
                拖放圖片到這裡
              </div>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text-lo)', marginBottom: 16 }}>
                或點擊選擇檔案（支援 PNG、JPG、WEBP）
              </div>
              <button className="btn-ghost" type="button" style={{ pointerEvents: 'none' }}>
                選擇圖片
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
            </div>
          ) : (
            <div style={{
              position: 'relative',
              borderRadius: 'var(--radius-card)',
              overflow: 'hidden',
              border: '1px solid var(--color-line-mid)',
            }}>
              <img
                src={imagePreview}
                alt="預覽"
                style={{ width: '100%', maxHeight: 340, objectFit: 'contain', display: 'block', background: 'var(--color-surf-1)' }}
              />
              <button
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6,
                  color: '#fff', padding: '4px 10px', cursor: 'pointer', fontSize: 'var(--font-sm)',
                }}
                onClick={() => { setImageFile(null); setImagePreview(null); }}
              >
                <Icon name="close" size={12} style={{ display: 'inline', marginRight: 4 }} /> 重選
              </button>
              <div style={{
                padding: '8px 14px',
                background: 'var(--color-surf-1)',
                fontSize: 'var(--font-sm)',
                color: 'var(--color-text-mid)',
                borderTop: '1px solid var(--color-line-faint)',
              }}>
                {imageFile?.name} · {imageFile ? (imageFile.size / 1024).toFixed(0) : 0} KB
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-text-mid)', marginBottom: 6, fontWeight: 600 }}>
              來源網址（選填）
            </label>
            <input
              className="input-field"
              type="url"
              placeholder="https://..."
              value={imgSourceUrl}
              onChange={(e) => setImgSourceUrl(e.target.value)}
            />
          </div>

          <div style={{
            background: 'var(--color-circuit-dim)',
            border: '1px solid var(--color-circuit-border)',
            borderRadius: 'var(--radius-card)',
            padding: '12px 16px',
            fontSize: 'var(--font-sm)',
            color: 'var(--color-circuit-light)',
          }}>
            <Icon name="lightbulb" size={12} style={{ display: 'inline', marginRight: 4 }} /> 上傳後 AI 會自動 OCR 提取圖片中的文字，再生成摘要和標籤
          </div>

          {error && <div style={{ color: 'var(--color-failed)', fontSize: 'var(--font-sm)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmitImage} disabled={loading || !imageFile}>
              {loading ? <Spinner size={16} color="#fff" /> : <><Icon name="sparkle" size={13} /> 上傳並讓 AI 處理</>}
            </button>
            <button className="btn-ghost" onClick={() => navigate(-1)} disabled={loading}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
