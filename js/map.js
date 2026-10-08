// map.js — force-directed theme map: layout, pan/zoom and rendering.

import {
  state, esc, getCategoryForTheme, CATEGORY_COLORS, CATEGORY_LABELS, setHash,
} from "./core.js";
import { switchView, applyFilters } from "./ui.js";

/* ─── Map: force-directed layout (Fruchterman-Reingold) ─────────── */

function forceLayout(nodes, edges, width, height) {
  const n = nodes.length;
  if (n === 0) return;
  const cx = width / 2, cy = height / 2;
  const R  = Math.min(width, height) * 0.36;

  // Circular init
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    node.x = cx + R * Math.cos(angle);
    node.y = cy + R * Math.sin(angle);
  });

  // Increased k for better node separation (0.9 instead of 0.5)
  const k = Math.sqrt((width * height) / n) * 0.9;
  let temp = Math.min(width, height) * 0.12;

  // Node physical dimensions for collision avoidance (width + margin, height + margin)
  const NW = 165, NH = 108;

  for (let iter = 0; iter < 300; iter++) {
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);

    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const ddx = nodes[i].x - nodes[j].x;
        const ddy = nodes[i].y - nodes[j].y;
        const dist = Math.max(Math.hypot(ddx, ddy), 1);
        const f = (k * k) / dist;
        fx[i] += (ddx / dist) * f;
        fy[i] += (ddy / dist) * f;
      }
    }

    // Hard collision avoidance: treat nodes as NW×NH rectangles
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ddx = nodes[i].x - nodes[j].x;
        const ddy = nodes[i].y - nodes[j].y;
        const overlapX = NW - Math.abs(ddx);
        const overlapY = NH - Math.abs(ddy);
        if (overlapX > 0 && overlapY > 0) {
          const push = Math.min(overlapX, overlapY) * 0.6 + 1;
          if (overlapX < overlapY) {
            const dir = ddx >= 0 ? 1 : -1;
            fx[i] += dir * push; fx[j] -= dir * push;
          } else {
            const dir = ddy >= 0 ? 1 : -1;
            fy[i] += dir * push; fy[j] -= dir * push;
          }
        }
      }
    }

    // Attraction along edges
    edges.forEach(([a, b]) => {
      const ddx = nodes[b].x - nodes[a].x;
      const ddy = nodes[b].y - nodes[a].y;
      const dist = Math.max(Math.hypot(ddx, ddy), 1);
      const f = (dist * dist) / k;
      fx[a] += (ddx / dist) * f;
      fy[a] += (ddy / dist) * f;
      fx[b] -= (ddx / dist) * f;
      fy[b] -= (ddy / dist) * f;
    });

    // Gentle gravity toward center
    nodes.forEach((node, i) => {
      fx[i] += (cx - node.x) * 0.02;
      fy[i] += (cy - node.y) * 0.02;
    });

    // Apply with temperature cooling
    nodes.forEach((node, i) => {
      const mag  = Math.hypot(fx[i], fy[i]) || 1;
      const step = Math.min(mag, temp);
      node.x += (fx[i] / mag) * step;
      node.y += (fy[i] / mag) * step;
      // Keep inside padded bounds
      const px = 90, py = 60;
      node.x = Math.max(px, Math.min(width  - px, node.x));
      node.y = Math.max(py, Math.min(height - py, node.y));
    });

    temp *= 0.97;
  }
}
/* ─── Map: pan/zoom state ────────────────────────────────────────── */

let mapTransform = { x: 0, y: 0, scale: 1 };

function applyMapTransform(stage) {
  if (!stage) return;
  const { x, y, scale } = mapTransform;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function initMapInteraction() {
  const canvas = document.getElementById("map-canvas");
  if (!canvas) return;
  const getStage = () => document.getElementById("map-stage");

  // Mouse wheel → zoom toward cursor
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const newScale = Math.max(0.3, Math.min(3, mapTransform.scale * factor));
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = (mx - mapTransform.x) / mapTransform.scale;
    const dy = (my - mapTransform.y) / mapTransform.scale;
    mapTransform.x = mx - dx * newScale;
    mapTransform.y = my - dy * newScale;
    mapTransform.scale = newScale;
    applyMapTransform(getStage());
  }, { passive: false });

  // Mouse drag → pan
  let dragging = false, startX, startY, startTX, startTY;
  canvas.addEventListener("mousedown", e => {
    if (e.button !== 0 || e.target.closest(".map-node")) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startTX = mapTransform.x; startTY = mapTransform.y;
    canvas.style.cursor = "grabbing";
    e.preventDefault();
  });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    mapTransform.x = startTX + (e.clientX - startX);
    mapTransform.y = startTY + (e.clientY - startY);
    applyMapTransform(getStage());
  });
  window.addEventListener("mouseup", () => {
    if (dragging) { dragging = false; canvas.style.cursor = ""; }
  });

  // Zoom buttons
  document.getElementById("map-zoom-in")?.addEventListener("click", () => {
    mapTransform.scale = Math.min(3, mapTransform.scale * 1.25);
    applyMapTransform(getStage());
  });
  document.getElementById("map-zoom-out")?.addEventListener("click", () => {
    mapTransform.scale = Math.max(0.3, mapTransform.scale / 1.25);
    applyMapTransform(getStage());
  });
  document.getElementById("map-zoom-reset")?.addEventListener("click", () => {
    mapTransform = { x: 0, y: 0, scale: 1 };
    applyMapTransform(getStage());
  });
}
/* ─── Map: render ───────────────────────────────────────────────── */

function renderMapLegend() {
  const legendEl = document.getElementById("map-legend");
  if (!legendEl) return;
  const categories = [...new Set(state.themes.map(t => getCategoryForTheme(t.slug)))];
  legendEl.innerHTML = categories.map(cat =>
    `<span class="map-legend-item">
       <span class="map-legend-dot" style="background:${CATEGORY_COLORS[cat] || "#999"}"></span>
       ${esc(CATEGORY_LABELS[cat] || cat)}
     </span>`
  ).join("");
}

function renderMap() {
  const canvas = document.getElementById("map-canvas");
  const svg    = document.getElementById("map-svg");
  const stage  = document.getElementById("map-stage");
  if (!canvas || !svg || !stage || !state.themes.length) return;

  const { width, height } = canvas.getBoundingClientRect();
  if (width < 100 || height < 100) return;

  // Reset pan/zoom for a fresh render
  mapTransform = { x: 0, y: 0, scale: 1 };
  applyMapTransform(stage);

  // Build node list
  const slugIndex = new Map(state.themes.map((t, i) => [t.slug, i]));
  const nodes = state.themes.map(t => ({
    slug:      t.slug,
    title:     t.title,
    count:     t.work_count ?? 0,
    authors:   (t.key_author_names ?? []).slice(0, 2),
    category:  getCategoryForTheme(t.slug),
    neighbors: t.related_themes ?? [],
    x: 0, y: 0,
  }));

  // Build deduplicated edge list
  const edgeSet = new Set();
  const edgeList = [];
  state.themes.forEach(t => {
    (t.related_themes || []).forEach(relSlug => {
      const a = slugIndex.get(t.slug), b = slugIndex.get(relSlug);
      if (a == null || b == null) return;
      const key = [Math.min(a, b), Math.max(a, b)].join("-");
      if (!edgeSet.has(key)) { edgeSet.add(key); edgeList.push([a, b]); }
    });
  });

  forceLayout(nodes, edgeList, width, height);

  // Compute node degrees for variable sizing
  const nodeDegree = new Array(nodes.length).fill(0);
  edgeList.forEach(([a, b]) => { nodeDegree[a]++; nodeDegree[b]++; });
  const maxDeg = Math.max(...nodeDegree, 1);
  const cx = width / 2, cy = height / 2;

  // Render SVG edges inside the stage
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width  = `${width}px`;
  svg.style.height = `${height}px`;
  svg.innerHTML = "";
  edgeList.forEach(([a, b]) => {
    const na = nodes[a], nb = nodes[b];
    const mx = (na.x + nb.x) / 2;
    const my = (na.y + nb.y) / 2;
    const dx = mx - cx, dy = my - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const edgeLen = Math.hypot(nb.x - na.x, nb.y - na.y);
    const curve = edgeLen * 0.18;
    const cpx = mx + (dx / dist) * curve;
    const cpy = my + (dy / dist) * curve;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${na.x} ${na.y} Q ${cpx} ${cpy} ${nb.x} ${nb.y}`);
    path.setAttribute("class", "map-edge");
    path.setAttribute("fill", "none");
    path.dataset.a = na.slug;
    path.dataset.b = nb.slug;
    svg.appendChild(path);
  });

  // Remove old nodes then render into stage (not canvas)
  stage.querySelectorAll(".map-node").forEach(el => el.remove());

  nodes.forEach((node, i) => {
    const color = CATEGORY_COLORS[node.category] || "#999";
    const degree = nodeDegree[i];
    const nodeWidth = 148 + Math.round((degree / maxDeg) * 24); // 148–172px
    const el = document.createElement("div");
    el.className = "map-node";
    el.style.cssText = `left:${node.x}px; top:${node.y}px; --cat-color:${color}; --node-w:${nodeWidth}px;`;
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `Ver tema: ${node.title}`);
    el.dataset.slug = node.slug;

    el.innerHTML = `
      <div class="map-node__inner">
        <div class="map-node__header">
          <span class="map-node__dot"></span>
          <span class="map-node__title">${esc(node.title)}</span>
        </div>
        <div class="map-node__count">${node.count} obra${node.count !== 1 ? "s" : ""}</div>
        <div class="map-node__authors">${node.authors.map(esc).join(" · ")}</div>
      </div>`;

    const navigate = () => {
      switchView("temas");
      state.selectedSlug = node.slug;
      state.activeTab = "overview";
      setHash(node.slug);
      applyFilters();
    };

    el.addEventListener("click", navigate);
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(); }
    });

    // Hover: highlight connected nodes + edges
    el.addEventListener("mouseenter", () => {
      // Derive neighbors from rendered edges — handles bidirectional links correctly
      const connectedSlugs = new Set();
      svg.querySelectorAll(".map-edge").forEach(e => {
        if (e.dataset.a === node.slug) connectedSlugs.add(e.dataset.b);
        if (e.dataset.b === node.slug) connectedSlugs.add(e.dataset.a);
      });
      stage.querySelectorAll(".map-node").forEach(n => {
        n.classList.toggle("map-node--dim",
          n.dataset.slug !== node.slug && !connectedSlugs.has(n.dataset.slug));
      });
      svg.querySelectorAll(".map-edge").forEach(e => {
        const connected = e.dataset.a === node.slug || e.dataset.b === node.slug;
        e.classList.toggle("map-edge--active", connected);
        e.classList.toggle("map-edge--dim", !connected);
      });
    });

    el.addEventListener("mouseleave", () => {
      stage.querySelectorAll(".map-node").forEach(n => n.classList.remove("map-node--dim"));
      svg.querySelectorAll(".map-edge").forEach(e =>
        e.classList.remove("map-edge--active", "map-edge--dim"));
    });

    stage.appendChild(el);
  });

  renderMapLegend();
}

// Re-render map on canvas resize
const _mapCanvas = document.getElementById("map-canvas");
if (_mapCanvas && "ResizeObserver" in window) {
  new ResizeObserver(() => { if (state.view === "mapa") renderMap(); }).observe(_mapCanvas);
}

export { renderMap, initMapInteraction };
