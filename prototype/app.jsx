/* ============================================================
   app.jsx — orchestrator: pin → profiles → tracker + aesthetic toggle
   ============================================================ */

function clone(o) { return JSON.parse(JSON.stringify(o)); }
const DEFAULT_THEME = { Rafael: "billionaire", Thrisha: "girly" };
const STORAGE_KEY = "moneyflow.data.v1";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.Rafael && d.Thrisha) return d;
    }
  } catch (e) {}
  return clone(EMPTY); // fresh from scratch
}

function TopBar({ me, viewing, theme, setTheme, onBack }) {
  const canEdit = me === viewing;
  const c = COPY[theme];
  return (
    <div style={{ position: "relative", zIndex: 2 }}>
      <div style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in oklch, var(--bg) 82%, transparent)", backdropFilter: "blur(12px)" }}>
        <div className="wrap" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", minHeight: 64 }}>
          <button className="icon-btn" onClick={onBack}><Icon name="chevL" size={18} /></button>
          <div className="row grow" style={{ gap: 11, minWidth: 0 }}>
            <Avatar who={viewing} size={40} ring={canEdit} />
            <div className="stack" style={{ gap: 2, minWidth: 0 }}>
              <span className="display" style={{ fontSize: 18, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{viewing}'s {viewing === "Rafael" ? "Portfolio" : "Garden"}</span>
              <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {canEdit ? "you can edit everything" : `viewing as ${me} · look but don't touch`}
              </span>
            </div>
          </div>
          <div className="seg no-sel">
            <button className={theme === "billionaire" ? "on" : ""} onClick={() => setTheme("billionaire")} title="Billionaire">
              <Icon name="crown" size={15} /><span className="tg-label"> Billionaire</span>
            </button>
            <button className={theme === "girly" ? "on" : ""} onClick={() => setTheme("girly")} title="Girly">
              <Icon name="heart" size={15} /><span className="tg-label"> Girly</span>
            </button>
          </div>
        </div>
      </div>
      {!canEdit && (
        <div className="readonly-bar">
          <Icon name="eye" size={14} /> Read-only — only {viewing} can edit this {viewing === "Rafael" ? "portfolio" : "garden"}.
        </div>
      )}
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState("pin");     // pin | profiles | tracker
  const [me, setMe] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [theme, setTheme] = useState("billionaire");
  const [data, setData] = useState(loadData);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }, [data]);

  const shellTheme = screen === "tracker" ? theme : (me ? DEFAULT_THEME[me] : "billionaire");
  const CCY = { Rafael: "PHP", Thrisha: "QAR" };

  const openProfile = (who) => {
    setActiveCcy(CCY[who]);
    setViewing(who);
    setTheme(DEFAULT_THEME[who]);
    setScreen("tracker");
  };
  const updateRafael = (fn) => setData((d) => ({ ...d, Rafael: { ...fn(d.Rafael), lastUpdated: Date.now() } }));
  const updateThrisha = (fn) => setData((d) => ({ ...d, Thrisha: { ...fn(d.Thrisha), lastUpdated: Date.now() } }));

  return (
    <div className="app" data-theme={shellTheme}>
      {screen === "pin" && (
        <PatternLock onSolve={(who) => { setMe(who); setScreen("profiles"); }} />
      )}

      {screen === "profiles" && (
        <div className="screen">
          <div style={{ position: "absolute", top: 18, right: 0, left: 0 }}>
            <div className="wrap between">
              <span className="chip" style={{ fontSize: 11 }}><Icon name="lock" size={12} /> {COPY[shellTheme].appName}</span>
              <button className="btn ghost" style={{ fontSize: 12.5, padding: "8px 12px" }} onClick={() => { setMe(null); setScreen("pin"); }}>
                <Icon name="lock" size={14} /> lock
              </button>
            </div>
          </div>
          <ProfileSelect me={me} onOpen={openProfile} />
        </div>
      )}

      {screen === "tracker" && (
        <div className="screen">
          <TopBar me={me} viewing={viewing} theme={theme} setTheme={setTheme} onBack={() => setScreen("profiles")} />
          {viewing === "Rafael"
            ? <RafaelTracker data={data.Rafael} canEdit={me === "Rafael"} update={updateRafael} theme={theme} me={me} />
            : <ThrishaTracker data={data.Thrisha} canEdit={me === "Thrisha"} update={updateThrisha} theme={theme} me={me} />}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
