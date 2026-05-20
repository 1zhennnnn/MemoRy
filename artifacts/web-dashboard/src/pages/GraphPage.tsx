import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../shared/api';
import { graphData } from '../shared/pageCache';
import Spinner from '../components/common/Spinner';
import Icon from '../components/common/Icon';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GNode { id: string; title: string | null; summary: string | null; tags: string[]; }
interface GEdge { source: string; target: string; type: 'tag' | 'semantic'; weight: number; }
interface SimNode extends GNode { x: number; y: number; vx: number; vy: number; r: number; degree: number; }
interface HoverInfo {
  id: string; title: string | null; summary: string | null;
  tags: string[]; degree: number; tagDeg: number; semDeg: number;
  sx: number; sy: number;
}
interface Transform { s: number; x: number; y: number; }
interface Star { x: number; y: number; r: number; base: number; phase: number; }

// ── Simulation ────────────────────────────────────────────────────────────────

const REPULSION   = 70000;
const TAG_REST    = 130;
const SEM_REST    = 260;
const SPRING_K    = 0.018;
const CENTER_G    = 0.002;
const FRICTION    = 0.82;
const ALPHA_DECAY = 0.993;

function tagHue(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0) % 360;
}
// Lower saturation for constellation aesthetic
function nodeColor(tags: string[], a = 1) {
  return tags.length ? `hsla(${tagHue(tags[0]!)},38%,62%,${a})` : `rgba(80,88,108,${a})`;
}
function nodeR(degree: number) { return Math.max(5, Math.min(18, 5 + Math.log1p(degree) * 3.2)); }

// ── Stars ─────────────────────────────────────────────────────────────────────

function initStars(w: number, h: number, count = 200): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: Math.random() * 1.3 + 0.15,
    base: Math.random() * 0.32 + 0.04,
    phase: Math.random() * Math.PI * 2,
  }));
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], t: number) {
  for (const s of stars) {
    const opacity = s.base * (0.65 + 0.35 * Math.sin(t * 0.0008 + s.phase));
    if (s.r > 0.9) {
      // Subtle glow for larger stars
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
      g.addColorStop(0, `rgba(180,215,255,${opacity * 0.18})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,222,255,${opacity})`;
    ctx.fill();
  }
}

// ── Ring (Saturn-style halo for high-degree nodes) ────────────────────────────

function drawRing(ctx: CanvasRenderingContext2D, n: SimNode, t: number) {
  const angle = (t * 0.00022) % (Math.PI * 2);
  const rx = n.r * 2.5, ry = n.r * 0.5;
  ctx.save();
  ctx.translate(n.x, n.y);
  ctx.rotate(angle);
  // Outer ring
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100,210,255,0.3)';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // Inner ring (slightly smaller, more transparent)
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.78, ry * 0.78, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(140,225,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function tick(nodes: SimNode[], edges: GEdge[], map: Record<string, SimNode>, w: number, h: number, alpha: number) {
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = Math.max(dx * dx + dy * dy, 0.01);
      const d  = Math.sqrt(d2);
      const f  = (REPULSION * alpha) / d2;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
    }
  }
  for (const e of edges) {
    const a = map[e.source], b = map[e.target];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d  = Math.sqrt(dx * dx + dy * dy) || 1;
    const rest = e.type === 'tag' ? TAG_REST : SEM_REST;
    const f  = (d - rest) * SPRING_K * alpha;
    const fx = (dx / d) * f, fy = (dy / d) * f;
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
  }
  for (const n of nodes) {
    n.vx -= (n.x - cx) * CENTER_G;
    n.vy -= (n.y - cy) * CENTER_G;
    n.vx *= FRICTION; n.vy *= FRICTION;
    n.x += n.vx; n.y += n.vy;
  }
}

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: SimNode[], edges: GEdge[], map: Record<string, SimNode>,
  t: Transform, worldMx: number | null, worldMy: number | null,
  filterIds: Set<string>,
  stars: Star[], time: number, ringThreshold: number,
): SimNode | null {
  const w = ctx.canvas.width, h = ctx.canvas.height;

  // Clear (let CSS background show through, respects theme)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Stars in screen space (fixed, parallax)
  drawStars(ctx, stars, time);

  // World space
  ctx.setTransform(t.s, 0, 0, t.s, t.x, t.y);

  // Find hovered
  let hov: SimNode | null = null;
  if (worldMx !== null && worldMy !== null) {
    for (const n of nodes) {
      const dx = worldMx - n.x, dy = worldMy - n.y;
      if (dx * dx + dy * dy < (n.r * 2.5) ** 2) { hov = n; break; }
    }
  }

  const hasFilter = filterIds.size > 0;

  // Neighbour set (for hover)
  const nbrs = new Set<string>();
  const litKeys = new Set<string>();
  if (hov) {
    for (const e of edges) {
      if (e.source === hov.id) { nbrs.add(e.target); litKeys.add(`${e.source}|${e.target}`); }
      else if (e.target === hov.id) { nbrs.add(e.source); litKeys.add(`${e.source}|${e.target}`); }
    }
  }

  // Rings (draw before edges so they appear behind)
  for (const n of nodes) {
    if (n.degree > ringThreshold) drawRing(ctx, n, time);
  }

  // Edges — tag edges → cyan constellation lines
  for (const e of edges) {
    const a = map[e.source], b = map[e.target];
    if (!a || !b) continue;
    const lit = hov
      ? litKeys.has(`${e.source}|${e.target}`)
      : !hasFilter || filterIds.has(e.source) || filterIds.has(e.target);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    if (e.type === 'tag') {
      ctx.strokeStyle = lit ? 'rgba(0,200,220,0.55)' : 'rgba(0,200,220,0.12)';
      ctx.lineWidth = lit ? 1.8 : 0.6;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = lit ? 'rgba(120,120,200,0.38)' : 'rgba(120,120,200,0.09)';
      ctx.lineWidth = lit ? 1 : 0.5;
      ctx.setLineDash([4, 6]);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Nodes
  const sorted = (hov || hasFilter)
    ? [...nodes].sort((a) => (a.id === hov?.id ? 1 : (nbrs.has(a.id) || filterIds.has(a.id)) ? 0 : -1))
    : nodes;
  for (const n of sorted) {
    const isHov = hov?.id === n.id;
    const isNbr = nbrs.has(n.id);
    const isMatch = filterIds.has(n.id);
    const dim = hov ? (!isHov && !isNbr) : (hasFilter && !isMatch);
    // Dim nodes shrink slightly + fade — like distant stars, not invisible
    const r = isHov ? n.r * 2.2 : (isNbr || isMatch) ? n.r * 1.25 : dim ? n.r * 0.82 : n.r;
    const alpha = dim ? 0.42 : 1;     // 0.42 keeps the "star field" visible behind focus

    // Hover glow (star-like radial)
    if (isHov) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r + 18);
      g.addColorStop(0, nodeColor(n.tags, 0.3));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(n.x, n.y, r + 18, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    }

    // Node fill
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isHov ? 'rgba(240,248,255,0.95)' : nodeColor(n.tags, alpha);
    ctx.fill();
    // Rim light — dim nodes still get a faint rim so they look like distant stars
    ctx.strokeStyle = isHov
      ? 'rgba(180,230,255,0.9)'
      : n.tags.length
        ? `hsla(${tagHue(n.tags[0]!)},60%,85%,${dim ? 0.18 : 0.35})`
        : `rgba(180,195,220,${dim ? 0.12 : 0.22})`;
    ctx.lineWidth = isHov ? 2 : 0.7;
    ctx.stroke();

    // Label — dim nodes show faint label if large enough (distant star names)
    const showLabel = isHov || (!dim && n.r >= 10) || (dim && n.r >= 14);
    if (showLabel && n.title) {
      const label = n.title.length > 16 ? n.title.slice(0, 15) + '…' : n.title;
      const isDark = document.documentElement.dataset.theme !== 'light';
      ctx.font = `${isHov ? 600 : 400} ${isHov ? 12 : 10}px -apple-system,sans-serif`;
      if (isDark) {
        ctx.fillStyle = isHov ? 'rgba(220,240,255,0.95)' : `rgba(190,210,235,${dim ? 0.28 : 0.65})`;
      } else {
        // Light mode: dark text with slight contrast
        ctx.fillStyle = isHov ? 'rgba(10,20,50,0.95)' : `rgba(30,45,80,${dim ? 0.45 : 0.82})`;
      }
      ctx.textAlign = 'center';
      ctx.fillText(label, n.x, n.y + r + 14);
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return hov;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphPage() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const simRef     = useRef<{
    nodes: SimNode[]; edges: GEdge[]; map: Record<string, SimNode>;
    alpha: number; degrees: Record<string, { tag: number; sem: number }>;
  } | null>(null);
  const rafRef     = useRef(0);
  const mouseRef   = useRef<{ x: number; y: number } | null>(null);
  const hovRef     = useRef<SimNode | null>(null);
  const tRef       = useRef<Transform>({ s: 1, x: 0, y: 0 });
  const dragRef     = useRef<{ sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null);
  const nodeDragRef = useRef<{ nodeId: string; moved: boolean; startX: number; startY: number } | null>(null);

  const filterIdsRef      = useRef<Set<string>>(new Set());
  const starsRef          = useRef<Star[]>([]);
  const timeRef           = useRef(0);
  const ringThresholdRef  = useRef(0);

  const [hover, setHover]         = useState<HoverInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [stats, setStats]         = useState({ nodes: 0, tagEdges: 0, semEdges: 0 });
  const [zoom, setZoom]           = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ]     = useState('');
  const [searchMode, setSearchMode] = useState<'keyword' | 'semantic'>('keyword');
  const [searching, setSearching] = useState(false);
  const [searchLabel, setSearchLabel] = useState('');   // "找到 N 筆" / "Top N 語意"
  const navigate = useNavigate();

  // ── Load data (with cache) ─────────────────────────────────────────────────
  useEffect(() => {
    const cached = graphData.get();
    const load = (data: Awaited<ReturnType<typeof api.graph.get>>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.offsetWidth || 900, h = canvas.offsetHeight || 700;

      const degrees: Record<string, { tag: number; sem: number }> = {};
      for (const n of data.nodes) degrees[n.id] = { tag: 0, sem: 0 };
      for (const e of data.edges) {
        degrees[e.source]![e.type === 'tag' ? 'tag' : 'sem']++;
        degrees[e.target]![e.type === 'tag' ? 'tag' : 'sem']++;
      }
      const nodes: SimNode[] = data.nodes.map((n) => {
        const deg = (degrees[n.id]?.tag ?? 0) + (degrees[n.id]?.sem ?? 0);
        return {
          ...n, r: nodeR(deg), degree: deg,
          x: w / 2 + (Math.random() - 0.5) * Math.min(w, h) * 0.75,
          y: h / 2 + (Math.random() - 0.5) * Math.min(w, h) * 0.75,
          vx: 0, vy: 0,
        };
      });
      // 70th-percentile degree → ring threshold
      const sorted70 = [...nodes].map((n) => n.degree).sort((a, b) => a - b);
      const ringThreshold = sorted70[Math.floor(sorted70.length * 0.7)] ?? 0;
      ringThresholdRef.current = ringThreshold;

      // Init stars (screen-space background)
      starsRef.current = initStars(w, h);

      const map: Record<string, SimNode> = {};
      for (const n of nodes) map[n.id] = n;
      simRef.current = { nodes, edges: data.edges, map, alpha: 1, degrees };
      setStats({
        nodes: data.nodes.length,
        tagEdges: data.edges.filter((e) => e.type === 'tag').length,
        semEdges: data.edges.filter((e) => e.type === 'semantic').length,
      });
    };

    if (cached) {
      load(cached);
      setLoading(false);
    } else {
      api.graph.get().then((data) => {
        graphData.set(data);
        load(data);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, []);

  // ── Resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      starsRef.current = initStars(canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function loop() {
      const sim = simRef.current;
      const ctx = canvas!.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      if (sim && sim.alpha > 0.003) {
        tick(sim.nodes, sim.edges, sim.map, canvas!.width, canvas!.height, sim.alpha);
        sim.alpha *= ALPHA_DECAY;
      }

      // Pin dragged node to mouse (after tick so forces don't override)
      const nd = nodeDragRef.current;
      if (nd && sim && mouseRef.current) {
        const tt = tRef.current;
        const n = sim.map[nd.nodeId];
        if (n) {
          n.x = (mouseRef.current.x - tt.x) / tt.s;
          n.y = (mouseRef.current.y - tt.y) / tt.s;
          n.vx = 0; n.vy = 0;
          sim.alpha = Math.max(sim.alpha, 0.35); // keep graph alive while dragging
        }
      }

      if (sim) {
        const m = mouseRef.current;
        const t = tRef.current;
        const wx = m ? (m.x - t.x) / t.s : null;
        const wy = m ? (m.y - t.y) / t.s : null;
        timeRef.current += 1;
        const hov = draw(
          ctx, sim.nodes, sim.edges, sim.map, t, wx, wy,
          filterIdsRef.current, starsRef.current, timeRef.current, ringThresholdRef.current,
        );

        if (hov?.id !== hovRef.current?.id) {
          hovRef.current = hov ?? null;
          if (hov) {
            const d = sim.degrees[hov.id] ?? { tag: 0, sem: 0 };
            setHover({
              id: hov.id, title: hov.title, summary: hov.summary, tags: hov.tags,
              degree: d.tag + d.sem, tagDeg: d.tag, semDeg: d.sem,
              sx: hov.x * t.s + t.x, sy: hov.y * t.s + t.y,
            });
          } else { setHover(null); }
        } else if (hov && hover) {
          const nsx = hov.x * t.s + t.x, nsy = hov.y * t.s + t.y;
          if (Math.abs(nsx - hover.sx) > 1 || Math.abs(nsy - hover.sy) > 1)
            setHover((h) => h ? { ...h, sx: nsx, sy: nsy } : h);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wheel zoom ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = tRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newS = Math.max(0.08, Math.min(10, t.s * factor));
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const wx = (sx - t.x) / t.s, wy = (sy - t.y) / t.s;
      tRef.current = { s: newS, x: sx - wx * newS, y: sy - wy * newS };
      setZoom(newS);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // ── Mouse events ───────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const t = tRef.current;
    const wx = (sx - t.x) / t.s, wy = (sy - t.y) / t.s;
    const sim = simRef.current;
    if (sim) {
      for (const n of sim.nodes) {
        if ((wx - n.x) ** 2 + (wy - n.y) ** 2 < (n.r * 2.5) ** 2) {
          // Start node drag — record start position for moved detection
          nodeDragRef.current = { nodeId: n.id, moved: false, startX: sx, startY: sy };
          return;
        }
      }
    }
    // Start pan drag
    dragRef.current = { sx, sy, tx: t.x, ty: t.y, moved: false };
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    mouseRef.current = { x: sx, y: sy };
    if (nodeDragRef.current) {
      // Compare against mousedown start position (not previous move event)
      const dx = sx - nodeDragRef.current.startX, dy = sy - nodeDragRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) nodeDragRef.current.moved = true;
    } else if (dragRef.current) {
      const dx = sx - dragRef.current.sx, dy = sy - dragRef.current.sy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
      if (dragRef.current.moved) {
        tRef.current = { ...tRef.current, x: dragRef.current.tx + dx, y: dragRef.current.ty + dy };
      }
    }
  }
  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    // Node drag end
    const nd = nodeDragRef.current;
    if (nd) {
      nodeDragRef.current = null;
      if (!nd.moved) {
        // Was a click, not a drag — navigate
        navigate(`/notes/${nd.nodeId}`);
      }
      return;
    }
    // Pan drag end
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.moved) return;
    // Tap on empty canvas — check node hit one more time
    const sim = simRef.current;
    if (!sim) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const t = tRef.current;
    const wx = (sx - t.x) / t.s, wy = (sy - t.y) / t.s;
    for (const n of sim.nodes) {
      if ((wx - n.x) ** 2 + (wy - n.y) ** 2 < (n.r * 2.5) ** 2) {
        navigate(`/notes/${n.id}`); return;
      }
    }
  }
  function onMouseLeave() {
    mouseRef.current = null; hovRef.current = null; setHover(null);
    dragRef.current = null; nodeDragRef.current = null;
  }

  // ── Search ────────────────────────────────────────────────────────────────

  function zoomToNode(n: SimNode) {
    const canvas = canvasRef.current; if (!canvas) return;
    const cx = canvas.offsetWidth / 2, cy = canvas.offsetHeight / 2;
    const s = 2.5;
    tRef.current = { s, x: cx - n.x * s, y: cy - n.y * s };
    setZoom(s);
  }

  const doKeyword = useCallback((q: string) => {
    const sim = simRef.current;
    if (!q.trim() || !sim) { filterIdsRef.current = new Set(); setSearchLabel(''); return; }
    const lq = q.toLowerCase();
    const ids = sim.nodes
      .filter((n) => n.title?.toLowerCase().includes(lq) || n.tags.some((t) => t.toLowerCase().includes(lq)))
      .map((n) => n.id);
    filterIdsRef.current = new Set(ids);
    setSearchLabel(ids.length ? `找到 ${ids.length} 筆` : '無符合');
    if (ids.length === 1) zoomToNode(sim.map[ids[0]!]!);
  }, []);

  const doSemantic = useCallback(async (q: string) => {
    const sim = simRef.current;
    if (!q.trim() || !sim) return;
    setSearching(true); setSearchLabel('搜尋中…');
    try {
      const res = await api.search.semantic(q);
      const ids = res.sources.map((s) => s.id).filter((id) => !!sim.map[id]);
      filterIdsRef.current = new Set(ids);
      setSearchLabel(ids.length ? `語意相似 Top ${ids.length}` : '圖譜中無相符');
      if (ids.length === 1) zoomToNode(sim.map[ids[0]!]!);
    } catch { setSearchLabel('搜尋失敗'); }
    finally { setSearching(false); }
  }, []);

  function clearSearch() {
    filterIdsRef.current = new Set();
    setSearchQ(''); setSearchLabel('');
  }

  function handleSearchOpen() {
    setSearchOpen((o) => { if (o) clearSearch(); return !o; });
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setSearchOpen(false); clearSearch(); return; }
    if (e.key === 'Enter') {
      if (searchMode === 'keyword') doKeyword(searchQ);
      else void doSemantic(searchQ);
    }
  }

  function onSearchChange(q: string) {
    setSearchQ(q);
    if (searchMode === 'keyword') doKeyword(q);
  }

  function switchMode(m: 'keyword' | 'semantic') {
    setSearchMode(m); clearSearch();
  }

  // ── View helpers ────────────────────────────────────────────────────────────

  function resetView() { tRef.current = { s: 1, x: 0, y: 0 }; setZoom(1); }
  function zoomBtn(delta: number) {
    const t = tRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.offsetWidth / 2, cy = canvas.offsetHeight / 2;
    const factor = delta > 0 ? 1.25 : 1 / 1.25;
    const newS = Math.max(0.08, Math.min(10, t.s * factor));
    const wx = (cx - t.x) / t.s, wy = (cy - t.y) / t.s;
    tRef.current = { s: newS, x: cx - wx * newS, y: cy - wy * newS };
    setZoom(newS);
  }

  // Card position: keep within viewport
  const canvasW = canvasRef.current?.offsetWidth ?? 900;
  const canvasH = canvasRef.current?.offsetHeight ?? 700;
  const CARD_W = 256;
  const cardL = hover ? Math.min(hover.sx + 20, canvasW - CARD_W - 8) : 0;
  const cardT = hover ? Math.max(8, Math.min(hover.sy - 16, canvasH - 200)) : 0;

  return (
    <div style={{ margin: -24, height: 'calc(100vh - 52px)', position: 'relative', overflow: 'hidden', background: 'var(--color-surf-0)' }}>

      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--color-text-lo)', fontSize: 13 }}>
          <Spinner size={16} /> 建構知識星座圖…
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block',
          cursor: (nodeDragRef.current?.moved || dragRef.current?.moved) ? 'grabbing' : hover ? 'grab' : 'default' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />

      {/* Search panel (top-centre) */}
      {searchOpen && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          width: 420, zIndex: 30,
          background: 'var(--color-surf-2)', border: '1px solid var(--color-line-faint)',
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {/* Single-row: [關鍵字|語意] + input + actions + close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Mode toggle — LEFT of input, 關鍵字 first / 語意 second */}
            <div style={{
              display: 'flex', flexShrink: 0,
              height: 32, boxSizing: 'border-box',
              background: 'var(--color-surf-1)',
              border: '1px solid var(--color-line-faint)',
              borderRadius: 7, overflow: 'hidden',
            }}>
              {(['keyword', 'semantic'] as const).map((m) => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  padding: '0 10px', height: '100%', fontSize: 12, cursor: 'pointer',
                  border: 'none', borderRight: m === 'keyword' ? '1px solid var(--color-line-faint)' : 'none',
                  background: searchMode === m ? 'var(--color-signal-dim)' : 'transparent',
                  color: searchMode === m ? 'var(--color-signal-light)' : 'var(--color-text-lo)',
                  whiteSpace: 'nowrap',
                }}>
                  {m === 'keyword' ? '關鍵字' : '語意'}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Icon name="search" size={13} style={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--color-text-lo)', pointerEvents: 'none',
              }} />
              <input
                autoFocus
                className="input-field"
                style={{ width: '100%', paddingLeft: 28, height: 32, fontSize: 13 }}
                placeholder={searchMode === 'keyword' ? '搜尋標題或 tag…' : '輸入問題後按 Enter…'}
                value={searchQ}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={onSearchKey}
              />
            </div>

            {searching && <Spinner size={14} />}
            {searchMode === 'semantic' && !searching && (
              <button className="btn-primary" style={{ fontSize: 12, padding: '0 12px', height: 32, flexShrink: 0 }}
                onClick={() => void doSemantic(searchQ)}>
                搜尋
              </button>
            )}
            <button onClick={() => { setSearchOpen(false); clearSearch(); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: 'var(--color-text-lo)', fontSize: 16, padding: '0 2px',
            }}>✕</button>
          </div>

          {/* Status */}
          {searchLabel && (
            <div style={{ fontSize: 11, color: 'var(--color-text-lo)', paddingLeft: 2 }}>
              {searchLabel}
              {filterIdsRef.current.size > 0 && (
                <button onClick={clearSearch} style={{
                  marginLeft: 8, fontSize: 11, background: 'none', border: 'none',
                  cursor: 'pointer', color: 'var(--color-text-lo)', textDecoration: 'underline',
                }}>清除</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Zoom controls — search btn on top */}
      <div style={{ position: 'absolute', right: 14, bottom: 50, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Search toggle */}
        <button onClick={handleSearchOpen} title="搜尋" style={{
          width: 30, height: 30, borderRadius: 7, cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: searchOpen ? 'var(--color-signal-dim)' : 'var(--color-surf-2)',
          border: `1px solid ${searchOpen ? 'var(--color-signal-border)' : 'var(--color-line-faint)'}`,
          color: searchOpen ? 'var(--color-signal-light)' : 'var(--color-text-mid)',
          marginBottom: 4,
        }}>
          <Icon name="search" size={14} />
        </button>

        {[
          { label: '+', action: () => zoomBtn(1), title: '放大' },
          { label: '−', action: () => zoomBtn(-1), title: '縮小' },
          { label: '⊙', action: resetView, title: '重置視角' },
        ].map(({ label, action, title }) => (
          <button key={label} onClick={action} title={title} style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'var(--color-surf-2)', border: '1px solid var(--color-line-faint)',
            color: 'var(--color-text-mid)', cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>{label}</button>
        ))}
        <div style={{ fontSize: 10, color: 'var(--color-text-lo)', textAlign: 'center', marginTop: 2 }}>
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Hover info card */}
      {hover && (
        <div style={{
          position: 'absolute', left: cardL, top: cardT, width: CARD_W,
          background: 'var(--color-surf-2)', border: '1px solid var(--color-line-faint)',
          borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          pointerEvents: 'none', zIndex: 20, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--color-line-faint)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-hi)', lineHeight: 1.4, wordBreak: 'break-word' }}>
              {hover.title ?? '無標題'}
            </div>
          </div>
          {hover.summary && (
            <div style={{ padding: '7px 12px 0', fontSize: 11, color: 'var(--color-text-mid)', lineHeight: 1.65,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {hover.summary}
            </div>
          )}
          <div style={{ padding: '8px 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hover.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {hover.tags.slice(0, 6).map((t) => (
                  <span key={t} style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: `hsla(${tagHue(t)},40%,28%,0.7)`,
                    color: `hsl(${tagHue(t)},65%,68%)`,
                    border: `1px solid hsla(${tagHue(t)},40%,50%,0.3)`,
                  }}>{t}</span>
                ))}
              </div>
            )}
            <div style={{ fontSize: 10, color: 'var(--color-text-lo)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span>● {hover.degree} 連結</span>
              {hover.tagDeg > 0 && <span style={{ color: 'rgba(0,210,225,0.9)' }}>tag×{hover.tagDeg}</span>}
              {hover.semDeg > 0 && <span style={{ color: 'rgba(150,140,230,0.9)' }}>語意×{hover.semDeg}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div style={{ position: 'absolute', bottom: 14, left: 16, display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-text-lo)' }}>
          <span>{stats.nodes} 筆記</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 2, background: 'rgba(0,210,225,0.8)', display: 'inline-block', verticalAlign: 'middle' }} />
            {stats.tagEdges} tag
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 1, background: 'rgba(140,130,220,0.6)', display: 'inline-block', verticalAlign: 'middle' }} />
            {stats.semEdges} 語意
          </span>
          <span style={{ opacity: 0.5 }}>滾輪縮放・拖曳平移</span>
        </div>
      )}
    </div>
  );
}
