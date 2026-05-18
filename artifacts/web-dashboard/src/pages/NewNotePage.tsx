import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import Spinner from '../components/common/Spinner';

type Tab = 'text' | 'image';

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
      navigate('/timeline');
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立失敗');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitImage() {
    if (!imageFile) { setError('請選擇圖片'); return; }
    setLoading(true); setError('');
    try {
      const base64 = await fileToBase64(imageFile);
      await api.notes.createImage({ imageBase64: base64, sourceUrl: imgSourceUrl || undefined, sourceTitle: imageFile.name });
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
        ✏ 新增筆記
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
          ✏ 輸入文字
        </button>
        <button style={tabStyle(tab === 'image')} onClick={() => { setTab('image'); setError(''); }}>
          🖼 上傳圖片
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
              {loading ? <Spinner size={16} color="#fff" /> : '✦ 送出並讓 AI 處理'}
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
              <div style={{ fontSize: 40, marginBottom: 12 }}>🖼</div>
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
                ✕ 重選
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
            💡 上傳後 AI 會自動 OCR 提取圖片中的文字，再生成摘要和標籤
          </div>

          {error && <div style={{ color: 'var(--color-failed)', fontSize: 'var(--font-sm)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmitImage} disabled={loading || !imageFile}>
              {loading ? <Spinner size={16} color="#fff" /> : '✦ 上傳並讓 AI 處理'}
            </button>
            <button className="btn-ghost" onClick={() => navigate(-1)} disabled={loading}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
