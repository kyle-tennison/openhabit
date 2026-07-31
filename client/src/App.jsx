import { useCallback, useEffect, useMemo, useState } from "react";
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

  const WINDOW = useWindowLength();
  const days = useMemo(() => windowDays(endKey, WINDOW), [endKey, WINDOW]);
  const startKey = days[0].key;

  const signOut = useCallback(() => {
    clearToken();
    setEmail(null);
    setHabits([]);
    setChecks(new Set());
    setMoods(new Map());
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

  useEffect(() => {
    if (!email) return;
    let cancelled = false;

    Promise.all([api.listHabits(), api.listChecks(startKey, endKey), api.listMoods(startKey, endKey)])
      .then(([habitList, checkList, moodList]) => {
        if (cancelled) return;
        setHabits(habitList);
        setChecks(new Set(checkList.map((c) => `${c.habitId}|${c.date}`)));
        setMoods(new Map(moodList.map((m) => [m.date, m.value])));
      })
      .catch(fail);

    return () => {
      cancelled = true;
    };
  }, [email, startKey, endKey, fail]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  /* ------------------------------- mutations ------------------------------ */

  function toggleCheck(habitId, date) {
    const key = `${habitId}|${date}`;
    setChecks((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

    api.toggleCheck(habitId, date).catch((err) => {
      setChecks((prev) => {
        const next = new Set(prev);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });
      fail(err);
    });
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

  function setMood(date, value) {
    const before = moods;
    setMoods((prev) => new Map(prev).set(date, value));
    api.setMood(date, value).catch((err) => {
      setMoods(before);
      fail(err);
    });
  }

  function clearMood(date) {
    const before = moods;
    setMoods((prev) => {
      const next = new Map(prev);
      next.delete(date);
      return next;
    });
    api.clearMood(date).catch((err) => {
      setMoods(before);
      fail(err);
    });
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
      </div>

      {notice && <div className="notice">{notice}</div>}

      <HabitGrid
        days={days}
        habits={habits}
        checks={checks}
        moods={moods}
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
