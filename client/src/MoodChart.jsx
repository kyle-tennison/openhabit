import { useEffect, useRef, useState } from "react";

const VB_W = 960;
// The chart is a fixed-aspect viewBox, so height has to come from the viewBox
// itself — a CSS height would just letterbox. Desktop gets a shorter box.
const VB_H_MOBILE = 400;
const VB_H_DESKTOP = 300;
const PAD = { top: 24, right: 18, bottom: 44, left: 38 };
const MIN = 1;
const MAX = 10;

const plotW = VB_W - PAD.left - PAD.right;

function useIsMobile() {
  const q = "(max-width: 640px)";
  const [is, setIs] = useState(() => window.matchMedia(q).matches);

  useEffect(() => {
    const mq = window.matchMedia(q);
    const sync = () => setIs(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return is;
}

function useViewBoxHeight() {
  const q = "(max-width: 640px)";
  const [h, setH] = useState(() => (window.matchMedia(q).matches ? VB_H_MOBILE : VB_H_DESKTOP));

  useEffect(() => {
    const mq = window.matchMedia(q);
    const sync = () => setH(mq.matches ? VB_H_MOBILE : VB_H_DESKTOP);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return h;
}

export default function MoodChart({ days, moods, onSet, onClear }) {
  const svgRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { key, value }
  // Shift-click clears a day, but there's no shift on a touch screen — so an
  // explicit mode makes clearing reachable there.
  const [erasing, setErasing] = useState(false);

  // On a phone the chart sits under the thumb while scrolling, so it starts
  // locked and has to be unlocked deliberately. Desktop is always editable.
  const isMobile = useIsMobile();
  const [unlocked, setUnlocked] = useState(false);
  const readOnly = isMobile && !unlocked;

  const VB_H = useViewBoxHeight();
  const plotH = VB_H - PAD.top - PAD.bottom;

  const colW = plotW / days.length;
  const x = (i) => PAD.left + (i + 0.5) * colW;
  const y = (v) => PAD.top + ((MAX - v) / (MAX - MIN)) * plotH;

  // Effective value for a day, including the point currently being dragged.
  const valueFor = (key) => (dragging?.key === key ? dragging.value : moods.get(key));

  const points = days
    .map((d, i) => ({ ...d, i, value: valueFor(d.key) }))
    .filter((p) => p.value != null);

  // Break the line wherever there is a day without a rating.
  const segments = [];
  for (const p of points) {
    const last = segments[segments.length - 1];
    if (last && last[last.length - 1].i === p.i - 1) last.push(p);
    else segments.push([p]);
  }

  function locate(event) {
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * VB_W;
    const sy = ((event.clientY - rect.top) / rect.height) * VB_H;

    const i = Math.min(days.length - 1, Math.max(0, Math.floor((sx - PAD.left) / colW)));
    const raw = MAX - ((sy - PAD.top) / plotH) * (MAX - MIN);
    const value = Math.min(MAX, Math.max(MIN, Math.round(raw)));

    return { day: days[i], value };
  }

  function handlePointerDown(event) {
    if (readOnly) return;
    const { day, value } = locate(event);
    if (day.isFuture) return;

    if (erasing || event.shiftKey) {
      if (moods.has(day.key)) onClear(day.key);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({ key: day.key, value });
  }

  function handlePointerMove(event) {
    if (!dragging) return;
    const { value } = locate(event);
    if (value !== dragging.value) setDragging({ ...dragging, value });
  }

  function handlePointerUp() {
    if (!dragging) return;
    if (moods.get(dragging.key) !== dragging.value) onSet(dragging.key, dragging.value);
    setDragging(null);
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Mood</h2>
        <div className="mood-tools">
          <span className="hint">
            {readOnly
              ? "Unlock to edit"
              : erasing
                ? "Tap a day to clear it"
                : "Click or drag to rate a day"}
          </span>
          {isMobile && (
            <button
              type="button"
              className={`mood-lock${unlocked ? "" : " on"}`}
              aria-pressed={unlocked}
              onClick={() => {
                setUnlocked((on) => !on);
                setErasing(false);
              }}
            >
              <i
                className={`bi bi-${unlocked ? "unlock" : "lock-fill"}`}
                aria-hidden="true"
              ></i>
            </button>
          )}
          <button
            type="button"
            disabled={readOnly}
            className={`erase${erasing ? " on" : ""}`}
            aria-pressed={erasing}
            onClick={() => setErasing((on) => !on)}
          >
            {erasing ? "Done" : "Erase Day"}
          </button>
        </div>
      </header>

      <svg
        ref={svgRef}
        className={`mood-chart${erasing ? " erasing" : ""}${readOnly ? " locked" : ""}`}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label="Mood over the last 30 days"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {[2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line
              className="grid-line"
              x1={PAD.left}
              x2={VB_W - PAD.right}
              y1={y(v)}
              y2={y(v)}
            />
            <text className="axis-label" x={PAD.left - 10} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {days.map((d, i) =>
          d.isToday ? (
            <rect
              key={d.key}
              className="today-band"
              x={x(i) - colW / 2}
              y={PAD.top}
              width={colW}
              height={plotH}
            />
          ) : null
        )}

        {segments.map((seg, idx) => (
          <polyline
            key={idx}
            className="mood-line"
            points={seg.map((p) => `${x(p.i)},${y(p.value)}`).join(" ")}
          />
        ))}

        {points.map((p) => (
          <circle
            key={p.key}
            className={`mood-point${p.isToday ? " is-today" : ""}${
              dragging?.key === p.key ? " is-dragging" : ""
            }`}
            cx={x(p.i)}
            cy={y(p.value)}
            r={p.isToday ? 7 : 6}
          />
        ))}

        {days.map((d, i) => (
          <text
            key={d.key}
            className={`axis-label day${d.isToday ? " is-today" : ""}`}
            x={x(i)}
            y={VB_H - 12}
            textAnchor="middle"
          >
            {d.dayOfMonth}
          </text>
        ))}
      </svg>
    </section>
  );
}
