import { useState } from "react";

export default function HabitGrid({
  days,
  habits,
  checks,
  moods,
  maxHabits,
  onToggle,
  onRename,
  onAdd,
  onDelete,
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const atLimit = habits.length >= maxHabits;

  function submitNew(e) {
    e.preventDefault();
    const name = draft.trim();
    if (!name || atLimit) return;
    setDraft("");
    setAdding(false);
    onAdd(name);
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Habits</h2>
      </header>

      <div className="grid-scroll">
        <div className="grid" style={{ "--days": days.length }}>
          <div className="grid-row grid-head">
            <div className="cell-name head-name">&nbsp;</div>
            {days.map((d) => (
              <div
                key={d.key}
                className={`cell-head${d.isToday ? " is-today" : ""}${
                  d.isWeekend ? " is-weekend" : ""
                }`}
              >
                <span className="weekday">{d.weekday}</span>
                <span className="daynum">{d.dayOfMonth}</span>
              </div>
            ))}
          </div>

          {habits.map((habit) => (
            <div className="grid-row" key={habit.id}>
              <div className="cell-name">
                <input
                  className="habit-name"
                  defaultValue={habit.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== habit.name) onRename(habit.id, name);
                    else e.target.value = habit.name;
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                />
                <button
                  className="delete"
                  title={`Delete “${habit.name}”`}
                  onClick={() => onDelete(habit)}
                >
                  ×
                </button>
              </div>

              {days.map((d) => {
                const on = checks.has(`${habit.id}|${d.key}`);
                return (
                  <button
                    key={d.key}
                    className={`cell${on ? " on" : ""}${d.isToday ? " is-today" : ""}${
                      d.isWeekend ? " is-weekend" : ""
                    }`}
                    disabled={d.isFuture}
                    aria-pressed={on}
                    aria-label={`${habit.name} on ${d.key}`}
                    onClick={() => onToggle(habit.id, d.key)}
                  />
                );
              })}
            </div>
          ))}

          {habits.length === 0 && (
            <p className="empty">Nothing tracked yet — add your first habit below.</p>
          )}

          {!adding && (
            <div className="grid-row grid-foot">
              <div className="cell-name">
                <button
                  type="button"
                  className="add-toggle"
                  aria-label="Add a habit"
                  disabled={atLimit}
                  onClick={() => setAdding(true)}
                >
                  <i className="bi bi-plus" aria-hidden="true"></i>
                </button>
              </div>
              {habits.length > 0 && <MoodSpark days={days} moods={moods} />}
            </div>
          )}
        </div>
      </div>

      {adding && (
        <form className="add-habit" onSubmit={submitNew}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={atLimit ? `Limit of ${maxHabits} habits reached` : "Add a habit…"}
            maxLength={80}
            disabled={atLimit}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
          />
          <button className="primary" type="submit" disabled={atLimit || !draft.trim()}>
            Add
          </button>
        </form>
      )}
    </section>
  );
}

function MoodSpark({ days, moods }) {
  const W = days.length * 100;
  const x = (i) => i * 100 + 50;
  const y = (v) => 8 + ((10 - v) / 9) * 84;

  const points = days
    .map((d, i) => ({ i, value: moods.get(d.key) }))
    .filter((p) => p.value != null);

  const segments = [];
  for (const p of points) {
    const last = segments[segments.length - 1];
    if (last && last[last.length - 1].i === p.i - 1) last.push(p);
    else segments.push([p]);
  }

  return (
    <svg
      className="mood-spark"
      viewBox={`0 0 ${W} 100`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {segments.map((seg, idx) => (
        <polyline
          key={idx}
          vectorEffect="non-scaling-stroke"
          points={seg.map((p) => `${x(p.i)},${y(p.value)}`).join(" ")}
        />
      ))}
    </svg>
  );
}
