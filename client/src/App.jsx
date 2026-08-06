import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, getToken, clearToken } from "./api.js";
import { addDays, rangeLabel, todayKey, windowDays } from "./dates.js";
import Auth from "./Auth.jsx";
import HabitGrid from "./HabitGrid.jsx";
import MoodChart from "./MoodChart.jsx";
import Footer from "./Footer.jsx";
import Logo from "./Logo.jsx";

const MAX_HABITS = 500;
const MOBILE = "(max-width: 640px)";

// A month of columns doesn't fit on a phone, so show a week there instead.
// Paging steps by whatever the current window is.
function useWindowLength() {
  const [length, setLength] = useState(() => (window.matchMedia(MOBILE).matches ? 5 : 30));

  useEffect(() => {
    const mq = window.matchMedia(MOBILE);
    const sync = () => setLength(mq.matches ? 5 : 30);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return length;
}

export default function App() {
  const [email, setEmail] = useState(null);
  const [booting, setBooting] = useState(true);

  const [endKey, setEndKey] = useState(todayKey());
  const [habits, setHabits] = useState([]);
  const [checks, setChecks] = useState(new Set());
  const [moods, setMoods] = useState(new Map());
  const [notice, setNotice] = useState("");
  // Only gates the first load — paging between windows keeps the grid on screen.
  const [loaded, setLoaded] = useState(false);

  const WINDOW = useWindowLength();
  const days = useMemo(() => windowDays(endKey, WINDOW), [endKey, WINDOW]);
  const startKey = days[0].key;

  const signOut = useCallback(() => {
    clearToken();
    setEmail(null);
    setHabits([]);
    setChecks(new Set());
    setMoods(new Map());
    setLoaded(false);
  }, []);

  const fail = useCallback(
    (err) => {
      setNotice(err.message);
      if (!getToken()) signOut();
    },
    [signOut]
  );

  useEffect(() => {
    if (!getToken()) return setBooting(false);
    api
      .me()
      .then((me) => setEmail(me.email))
      .catch(() => clearToken())
      .finally(() => setBooting(false));
  }, []);

  // Guards against a slow response landing after the user has already paged to
  // a different window: only the most recent request is allowed to apply.
  const requestRef = useRef(0);
  const lastFetchRef = useRef(0);

  const loadWindow = useCallback(() => {
    if (!email) return;

    const id = ++requestRef.current;
    lastFetchRef.current = Date.now();

    Promise.all([api.listHabits(), api.listChecks(startKey, endKey), api.listMoods(startKey, endKey)])
      .then(([habitList, checkList, moodList]) => {
        if (id !== requestRef.current) return;
        setHabits(habitList);
        setChecks(new Set(checkList.map((c) => `${c.habitId}|${c.date}`)));
        setMoods(new Map(moodList.map((m) => [m.date, m.value])));
      })
      .catch(fail)
      .finally(() => {
        if (id === requestRef.current) setLoaded(true);
      });
  }, [email, startKey, endKey, fail]);

  useEffect(() => {
    loadWindow();
  }, [loadWindow]);

  // Another device may have changed things while this tab sat in the background,
  // so re-read when it comes back to the front. Throttled so rapid tab switching
  // doesn't turn into a burst of requests.
  useEffect(() => {
    const REFETCH_AFTER_MS = 5000;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchRef.current < REFETCH_AFTER_MS) return;
      loadWindow();
    };

    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loadWindow]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /* ------------------------------- mutations ------------------------------ */

  /* --------------------------- undo / redo stack -------------------------- */
  // Session-only: entries describe a change and how to reverse it. Habit
  // add/rename/delete are deliberately excluded — this is for stray taps.

  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  function record(entry) {
    setPast((p) => [...p, entry]);
    setFuture([]);
  }

  function applyEntry(entry, direction) {
    if (entry.type === "check")
      applyCheck(entry.habitId, entry.date, direction === "undo" ? entry.before : entry.after);
    else applyMood(entry.date, direction === "undo" ? entry.before : entry.after);
  }

  function undo() {
    if (!past.length) return;
    const entry = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [...f, entry]);
    applyEntry(entry, "undo");
  }

  function redo() {
    if (!future.length) return;
    const entry = future[future.length - 1];
    setFuture((f) => f.slice(0, -1));
    setPast((p) => [...p, entry]);
    applyEntry(entry, "redo");
  }

  /* ------------------------------- mutations ------------------------------ */

  function applyCheck(habitId, date, checked) {
    const key = `${habitId}|${date}`;
    const snapshot = checks;

    setChecks((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });

    api.setCheck(habitId, date, checked).catch((err) => {
      setChecks(snapshot);
      fail(err);
    });
  }

  // Sends the state the user asked for rather than "flip whatever you have", so
  // a stale tab converges instead of writing the opposite value.
  function toggleCheck(habitId, date) {
    const checked = !checks.has(`${habitId}|${date}`);
    record({ type: "check", habitId, date, before: !checked, after: checked });
    applyCheck(habitId, date, checked);
  }

  function addHabit(name) {
    api
      .addHabit(name)
      .then((habit) => setHabits((prev) => [...prev, habit]))
      .catch(fail);
  }

  function renameHabit(id, name) {
    const before = habits;
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, name } : h)));
    api.renameHabit(id, name).catch((err) => {
      setHabits(before);
      fail(err);
    });
  }

  function deleteHabit(habit) {
    if (!confirm(`Delete “${habit.name}” and all of its history?`)) return;

    setHabits((prev) => prev.filter((h) => h.id !== habit.id));
    setChecks((prev) => {
      const next = new Set();
      for (const key of prev) if (!key.startsWith(`${habit.id}|`)) next.add(key);
      return next;
    });

    api.deleteHabit(habit.id).catch(fail);
  }

  function applyMood(date, value) {
    const snapshot = moods;
    setMoods((prev) => {
      const next = new Map(prev);
      if (value == null) next.delete(date);
      else next.set(date, value);
      return next;
    });

    const request = value == null ? api.clearMood(date) : api.setMood(date, value);
    request.catch((err) => {
      setMoods(snapshot);
      fail(err);
    });
  }

  function setMood(date, value) {
    record({ type: "mood", date, before: moods.get(date) ?? null, after: value });
    applyMood(date, value);
  }

  function clearMood(date) {
    record({ type: "mood", date, before: moods.get(date) ?? null, after: null });
    applyMood(date, null);
  }

  /* --------------------------------- views -------------------------------- */

  if (booting) return <div className="booting">openhabit</div>;
  if (!email) return <Auth onSignedIn={setEmail} />;

  const atToday = endKey === todayKey();

  return (
    <div className="app">
      <header className="app-head">
        <div className="brand">
          <Logo size={30} />
          <h1 className="wordmark">openhabit</h1>
        </div>
        <div className="who">
          <span>{email}</span>
          <button className="link" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="range">
        <button className="ghost" onClick={() => setEndKey(addDays(endKey, -WINDOW))}>
          ‹
        </button>
        <span className="range-label">{rangeLabel(days)}</span>
        <button
          className="ghost"
          onClick={() => {
            const next = addDays(endKey, WINDOW);
            setEndKey(next > todayKey() ? todayKey() : next);
          }}
          disabled={atToday}
        >
          ›
        </button>
        {!atToday && (
          <button className="link" onClick={() => setEndKey(todayKey())}>
            Back to today
          </button>
        )}

        <div className="history">
          <button
            className="ghost ghost-noborder"
            onClick={undo}
            disabled={!past.length}
            aria-label="Undo"
            title="Undo"
          >
            <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
          </button>
          <button
            className="ghost ghost-noborder"
            onClick={redo}
            disabled={!future.length}
            aria-label="Redo"
            title="Redo"
          >
            <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      {notice && <div className="notice">{notice}</div>}

      <HabitGrid
        days={days}
        habits={habits}
        checks={checks}
        moods={moods}
        loading={!loaded}
        maxHabits={MAX_HABITS}
        onToggle={toggleCheck}
        onRename={renameHabit}
        onAdd={addHabit}
        onDelete={deleteHabit}
      />

      <MoodChart days={days} moods={moods} onSet={setMood} onClear={clearMood} />

      <Footer />
    </div>
  );
}
