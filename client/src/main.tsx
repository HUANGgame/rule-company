import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import { BriefcaseBusiness, DoorOpen, Eye, EyeOff, KeyRound, LogIn, MessageSquare, Play, RadioTower, ShieldAlert, UserPlus, Zap } from "lucide-react";
import type { CharacterSkin, GameConfig, GameState, PrivatePlayerState, Rule, AuthUser, RoomSummary, Sabotage, TaskDef, EmployeeRole } from "@rule-company/shared";
import "./styles.css";

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);
const socketUrl = import.meta.env.VITE_SOCKET_URL || apiUrl;

type AuthState = { user: AuthUser; token: string };
type ShopItem = { id: string; name: string; description: string; price: number; effectType: string; available: boolean };
type Content = {
  rules: Rule[];
  tasks: TaskDef[];
  employeeRoles: EmployeeRole[];
  sabotages: Sabotage[];
  spiritualEvents: Array<Record<string, unknown>>;
  shopItems: ShopItem[];
  characterSkins: CharacterSkin[];
  gameConfig?: GameConfig;
};

function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const raw = localStorage.getItem("rule-company-auth");
    return raw ? JSON.parse(raw) : null;
  });
  const [content, setContent] = useState<Content>({ rules: [], tasks: [], employeeRoles: [], sabotages: [], spiritualEvents: [], shopItems: [], characterSkins: [] });
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [state, setState] = useState<GameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [notice, setNotice] = useState("連線準備中");

  useEffect(() => {
    fetch(`${apiUrl}/api/content`).then((res) => res.json()).then(setContent).catch(() => setNotice("內容載入失敗"));
    refreshRooms();
  }, []);

  useEffect(() => {
    if (!auth) return;
    localStorage.setItem("rule-company-auth", JSON.stringify(auth));
    const next = io(socketUrl, { auth: { token: auth.token } });
    next.on("connect", () => setNotice("即時連線已建立"));
    next.on("game_state", setState);
    next.on("private_state", setPrivateState);
    next.on("connect_error", (error) => setNotice(error.message));
    setSocket(next);
    return () => {
      next.close();
    };
  }, [auth]);

  const me = state?.players.find((player) => player.id === auth?.user.id);
  const isBoss = privateState?.faction === "boss";

  async function refreshRooms() {
    const data = await fetch(`${apiUrl}/api/rooms`).then((res) => res.json());
    setRooms(data.rooms);
  }

  async function createRoom() {
    if (!auth) return;
    const res = await fetch(`${apiUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ name: "夜班辦公室" })
    });
    const data = await res.json();
    setSelectedRoom(data.state.roomId);
    await refreshRooms();
    join(data.state.roomId);
  }

  function emit<T>(event: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve) => {
      socket?.emit(event, payload, (reply: any) => {
        if (!reply?.ok) setNotice(reply?.error || "操作失敗");
        else {
          setNotice("操作完成");
          resolve(reply);
        }
      });
    });
  }

  function join(roomId = selectedRoom) {
    if (!socket || !roomId) return;
    socket.emit("join_room", { roomId }, (reply: any) => {
      if (!reply.ok) setNotice(reply.error);
      else {
        setState(reply.state);
        setPrivateState(reply.privateState);
        setSelectedRoom(roomId);
        setNotice("已進入房間");
      }
    });
  }

  if (!auth) return <AuthPanel onAuth={setAuth} />;

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <h1>規則公司</h1>
          <span>Rule Company</span>
        </div>
        <div className="identity">
          <strong>{auth.user.name}</strong>
          <span>{auth.user.email}</span>
        </div>
        <button className="primaryButton" onClick={createRoom}><DoorOpen size={17} /> 建立房間</button>
        <button className="ghostButton" onClick={refreshRooms}><RadioTower size={17} /> 更新房間</button>
        <ShopPanel auth={auth} onAuth={setAuth} />
        <div className="roomList">
          {rooms.map((room) => (
            <button className={room.id === selectedRoom ? "room selected" : "room"} key={room.id} onClick={() => join(room.id)}>
              <strong>{room.name}</strong>
              <span>{room.status} · {room.playerCount}/{room.maxPlayers}</span>
            </button>
          ))}
        </div>
        <div className="notice">{notice}</div>
      </aside>

      <section className="playSurface">
        {state ? (
          <>
            <TopBar state={state} me={me} privateState={privateState} onReady={() => emit("player_ready", { roomId: state.roomId })} onStart={() => emit("start_match", { roomId: state.roomId, devMode: true })} />
            <div className="gameGrid">
              <GameCanvas state={state} meId={auth.user.id} onMove={(dx, dy) => emit("player_move", { roomId: state.roomId, dx, dy })} />
              <ActionPanel state={state} meId={auth.user.id} content={content} privateState={privateState} isBoss={isBoss} emit={emit} />
              <ChatPanel state={state} emit={emit} />
            </div>
            {(auth.user.isAdmin || import.meta.env.DEV) && <AdminPanel auth={auth} />}
          </>
        ) : (
          <div className="emptyState">
            <h2>選擇或建立房間</h2>
            <p>登入後即可建立多人房間，使用 Socket.IO 進行即時移動、任務、開會聊天與老闆干擾。</p>
          </div>
        )}
      </section>
    </main>
  );
}

function ShopPanel({ auth, onAuth }: { auth: AuthState; onAuth: (auth: AuthState) => void }) {
  const [items, setItems] = useState<Array<ShopItem | CharacterSkin>>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");

  const loadShop = useCallback(async () => {
    const res = await fetch(`${apiUrl}/api/shop/items`);
    const data = await res.json();
    setItems([...(data.items || []), ...(data.skins || [])]);
  }, []);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  async function buy(itemId: string) {
    const res = await fetch(`${apiUrl}/api/shop/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "購買失敗");
      return;
    }
    const nextAuth = { ...auth, user: data.user };
    localStorage.setItem("rule-company-auth", JSON.stringify(nextAuth));
    onAuth(nextAuth);
    setStatus(`已購買 ${data.item.name}`);
  }

  return (
    <>
      <section className="shopPanel">
        <div>
          <h2>商店</h2>
          <span>金幣 {auth.user.coins}</span>
        </div>
        <button className="primaryButton" onClick={() => setOpen(true)}>打開商店</button>
        {status && <span className="shopStatus">{status}</span>}
      </section>
      {open && (
        <div className="modalBackdrop" role="dialog" aria-modal="true" aria-label="商店">
          <section className="shopModal">
            <header>
              <div>
                <h2>商店</h2>
                <span>目前金幣 {auth.user.coins}</span>
              </div>
              <button className="ghostButton" onClick={() => setOpen(false)}>關閉</button>
            </header>
            <div className="shopCatalog">
              {items.map((item) => {
                const itemType = "imageUrl" in item ? "人物外觀" : "道具";
                const canBuy = auth.user.coins >= item.price;
                return (
                  <article className="shopCard" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{itemType}</span>
                    </div>
                    <p>{item.description}</p>
                    <footer>
                      <b>{item.price} 金幣</b>
                      <button className={canBuy ? "primaryButton" : "ghostButton"} disabled={!canBuy} onClick={() => buy(item.id)}>
                        {canBuy ? "購買" : "金幣不足"}
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function LegacyShopPanel({ auth, onAuth }: { auth: AuthState; onAuth: (auth: AuthState) => void }) {
  const [items, setItems] = useState<Array<ShopItem | CharacterSkin>>([]);
  const [status, setStatus] = useState(`金幣 ${auth.user.coins}`);

  const loadShop = useCallback(async () => {
    const res = await fetch(`${apiUrl}/api/shop/items`);
    const data = await res.json();
    setItems([...(data.items || []), ...(data.skins || [])]);
  }, []);

  useEffect(() => {
    loadShop();
  }, [loadShop]);

  async function buy(itemId: string) {
    const res = await fetch(`${apiUrl}/api/shop/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "購買失敗");
      return;
    }
    const nextAuth = { ...auth, user: data.user };
    localStorage.setItem("rule-company-auth", JSON.stringify(nextAuth));
    onAuth(nextAuth);
    setStatus(`已購買：${data.item.name}`);
  }

  return (
    <section className="shopPanel">
      <h2>商店</h2>
      <span>{status}</span>
      <div className="shopList">
        {items.map((item) => (
          <button key={item.id} onClick={() => buy(item.id)}>
            <strong>{item.name}</strong>
            <small>{item.price} 金幣</small>
          </button>
        ))}
      </div>
    </section>
  );
}

type AdminCollection = keyof Omit<Content, "gameConfig"> | "gameConfig";

function AdminPanel({ auth }: { auth: AuthState }) {
  const [collection, setCollection] = useState<AdminCollection>("gameConfig");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [json, setJson] = useState("");
  const [status, setStatus] = useState("後台可新增、修改、上下架內容");

  const load = useCallback(async () => {
    if (collection === "gameConfig") {
      const res = await fetch(`${apiUrl}/api/admin/game-config`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to load game numbers");
        return;
      }
      setItems([]);
      setSelectedId("game-config");
      setJson(JSON.stringify(data.config, null, 2));
      return;
    }
    const res = await fetch(`${apiUrl}/api/admin/content`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "後台載入失敗");
      return;
    }
    const list = data[collection] || [];
    setItems(list);
    if (!selectedId && list[0]) {
      setSelectedId(list[0].id);
      setJson(JSON.stringify(list[0], null, 2));
    }
  }, [auth.token, collection, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  function selectItem(id: string) {
    if (collection === "gameConfig") return;
    setSelectedId(id);
    const item = items.find((entry) => entry.id === id);
    setJson(JSON.stringify(item || templateFor(collection), null, 2));
  }

  async function save() {
    try {
      const item = JSON.parse(json);
      if (collection === "gameConfig") {
        const res = await fetch(`${apiUrl}/api/admin/game-config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
          body: JSON.stringify(item)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save game numbers");
        setStatus("Game numbers saved");
        setJson(JSON.stringify(data.config, null, 2));
        return;
      }
      if (!item.id) throw new Error("JSON 必須包含 id");
      const res = await fetch(`${apiUrl}/api/admin/content/${collection}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(item)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "儲存失敗");
      setSelectedId(item.id);
      setStatus("已儲存");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "JSON 格式錯誤");
    }
  }

  async function remove() {
    if (collection === "gameConfig") return;
    if (!selectedId) return;
    const res = await fetch(`${apiUrl}/api/admin/content/${collection}/${selectedId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    setStatus(res.ok ? "已刪除" : "刪除失敗");
    setSelectedId("");
    setJson(JSON.stringify(templateFor(collection), null, 2));
    await load();
  }

  async function toggleAvailable(available: boolean) {
    if (collection === "gameConfig") return;
    if (!selectedId) return;
    const res = await fetch(`${apiUrl}/api/admin/content/${collection}/${selectedId}/availability`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ available })
    });
    setStatus(res.ok ? (available ? "已上架" : "已下架") : "上下架失敗");
    await load();
  }

  return (
    <section className="adminPanel">
      <header>
        <h2>管理後台</h2>
        <span>{status}</span>
      </header>
      <div className="adminGrid">
        <div>
          <select value={collection} onChange={(event) => {
            const next = event.target.value as AdminCollection;
            setCollection(next);
            setSelectedId("");
            setJson(JSON.stringify(templateFor(next), null, 2));
          }}>
            <option value="rules">規則</option>
            <option value="employeeRoles">能力 / 員工技能</option>
            <option value="sabotages">老闆技能</option>
            <option value="characterSkins">人物形象</option>
            <option value="shopItems">商店商品</option>
          </select>
          <div className="adminTabs">
            <button className={collection === "gameConfig" ? "selected" : ""} onClick={() => {
              setCollection("gameConfig");
              setSelectedId("");
              setJson(JSON.stringify(templateFor("gameConfig"), null, 2));
            }}>Game Numbers</button>
            <button className={collection === "tasks" ? "selected" : ""} onClick={() => {
              setCollection("tasks");
              setSelectedId("");
              setJson(JSON.stringify(templateFor("tasks"), null, 2));
            }}>Tasks</button>
            <button className={collection === "spiritualEvents" ? "selected" : ""} onClick={() => {
              setCollection("spiritualEvents");
              setSelectedId("");
              setJson(JSON.stringify(templateFor("spiritualEvents"), null, 2));
            }}>Events</button>
          </div>
          <div className="adminList">
            {items.map((item) => (
              <button key={String(item.id)} className={item.id === selectedId ? "selected" : ""} onClick={() => selectItem(String(item.id))}>
                <strong>{String(item.name || item.title || item.id)}</strong>
                {"available" in item && <span>{item.available ? "上架" : "下架"}</span>}
              </button>
            ))}
          </div>
          <button className="ghostButton" onClick={() => {
            setSelectedId("");
            setJson(JSON.stringify(templateFor(collection), null, 2));
          }}>新增項目</button>
        </div>
        <div>
          <textarea value={json} onChange={(event) => setJson(event.target.value)} spellCheck={false} />
          <div className="adminActions">
            <button className="primaryButton" onClick={save}>儲存</button>
            <button className="ghostButton" onClick={remove}>刪除</button>
            {(collection === "shopItems" || collection === "characterSkins") && (
              <>
                <button className="ghostButton" onClick={() => toggleAvailable(true)}>上架</button>
                <button className="ghostButton" onClick={() => toggleAvailable(false)}>下架</button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function templateFor(collection: AdminCollection) {
  if (collection === "gameConfig") return {
    room: { minPlayers: 4, devMinPlayers: 3, maxPlayers: 10 },
    phases: { preparation: 25, work: 180, meeting: 60, event: 30, final_work: 150, escape: 60, ended: 0 },
    player: { hearts: 3, moveSpeed: 16, slowedMoveSpeed: 8, startX: 220, startY: 360, startSpacing: 34 },
    boss: { initialEnergy: 100, maxEnergy: 100, rechargePerSecond: 4, initialSabotageCount: 4 },
    scoring: { taskWorkDivisor: 3 }
  };
  if (collection === "tasks") return { id: "task-new", name: "New Task", area: "Reception", duration: 10, score: 10, kind: "timing" };
  if (collection === "spiritualEvents") return { id: "event-new", name: "New Event", description: "Event description", duration: 20, effectType: "custom" };
  if (collection === "rules") return { id: "rule-new", title: "新規則", text: "規則內容", category: "custom", difficulty: 2 };
  if (collection === "employeeRoles") return { id: "role-new", name: "新職業", description: "能力描述", activeSkill: "主動技能", passiveSkill: "被動技能", cooldown: 60 };
  if (collection === "sabotages") return { id: "sabotage-new", name: "新干擾", description: "技能描述", bossOnly: true, energyCost: 30, cooldown: 20, duration: 8, targetType: "player", effectType: "custom", suspicionGain: 10 };
  if (collection === "characterSkins") return { id: "skin-new", name: "新人物形象", description: "形象描述", imageUrl: "/skins/new.png", price: 100, available: true, faction: "employee" };
  return { id: "item-new", name: "新商品", description: "商品描述", price: 100, effectType: "custom", available: true };
}

function AuthPanel({ onAuth }: { onAuth: (auth: AuthState) => void }) {
  const initialParams = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(initialParams.get("resetToken") ? "reset" : "register");
  const [email, setEmail] = useState(initialParams.get("email") || "player@example.com");
  const [name, setName] = useState("夜班員工");
  const [password, setPassword] = useState("rules1234");
  const [confirmPassword, setConfirmPassword] = useState("rules1234");
  const [resetToken, setResetToken] = useState(initialParams.get("resetToken") || "");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    try {
      if (isForgot) {
        const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "無法建立重設碼");
        setStatus(data.resetToken ? `重設碼：${data.resetToken}` : "如果 Email 存在，系統已建立重設碼。");
        if (data.resetToken) setResetToken(data.resetToken);
        setMode("reset");
        return;
      }

      if (isReset) {
        if (password !== confirmPassword) throw new Error("兩次輸入的密碼不一致");
        const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token: resetToken.trim(), password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "密碼重設失敗");
        setStatus("密碼已更新，請使用新密碼登入。");
        setMode("login");
        return;
      }

      if (isRegister && password !== confirmPassword) throw new Error("兩次輸入的密碼不一致");
      const res = await fetch(`${apiUrl}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "驗證失敗");
      onAuth(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "發生未知錯誤");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: typeof mode) {
    setMode(next);
    setError("");
    setStatus("");
  }

  return (
    <main className="authScreen">
      <form className="authForm" onSubmit={submit}>
        <div className="authHeader">
          <h1>規則公司</h1>
          <p>{isForgot ? "輸入帳號 Email 以取得重設碼" : isReset ? "輸入重設碼並設定新密碼" : "登入後建立房間、邀請玩家並開始夜班"}</p>
        </div>
        {!isForgot && !isReset && (
          <div className="segmented">
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}><UserPlus size={16} /> 註冊</button>
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}><LogIn size={16} /> 登入</button>
          </div>
        )}
        {isRegister && <input value={name} onChange={(event) => setName(event.target.value)} placeholder="玩家名稱" autoComplete="name" required />}
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" autoComplete="email" required />
        {isReset && <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="重設碼" autoComplete="one-time-code" required />}
        {!isForgot && (
          <label className="passwordField">
            <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} placeholder={isReset ? "新密碼" : "密碼"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 4 : 8} />
            <button type="button" aria-label={showPassword ? "隱藏密碼" : "顯示密碼"} onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </label>
        )}
        {(isRegister || isReset) && (
          <label className="passwordField">
            <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showConfirmPassword ? "text" : "password"} placeholder="確認密碼" autoComplete="new-password" required minLength={8} />
            <button type="button" aria-label={showConfirmPassword ? "隱藏確認密碼" : "顯示確認密碼"} onClick={() => setShowConfirmPassword((value) => !value)}>
              {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </label>
        )}
        <button className="primaryButton" disabled={loading}>
          {isForgot ? <KeyRound size={17} /> : <Play size={17} />}
          {loading ? "處理中..." : isForgot ? "取得重設碼" : isReset ? "更新密碼" : mode === "login" ? "登入" : "建立帳號"}
        </button>
        <div className="authLinks">
          {!isForgot && !isReset && <button type="button" onClick={() => switchMode("forgot")}>忘記密碼？</button>}
          {(isForgot || isReset) && <button type="button" onClick={() => switchMode("login")}>返回登入</button>}
          {mode === "login" && <button type="button" onClick={() => switchMode("register")}>建立新帳號</button>}
        </div>
        {status && <p className="successText">{status}</p>}
        {error && <p className="errorText">{error}</p>}
      </form>
    </main>
  );
}

function LegacyAuthPanel({ onAuth }: { onAuth: (auth: AuthState) => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("player@example.com");
  const [name, setName] = useState("夜班員工");
  const [password, setPassword] = useState("rules1234");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch(`${apiUrl}/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password })
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "登入失敗");
    else onAuth(data);
  }

  return (
    <main className="authScreen">
      <form className="authForm" onSubmit={submit}>
        <h1>規則公司</h1>
        <div className="segmented">
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}><UserPlus size={16} /> 註冊</button>
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}><LogIn size={16} /> 登入</button>
        </div>
        {mode === "register" && <input value={name} onChange={(event) => setName(event.target.value)} placeholder="玩家名稱" />}
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="密碼" />
        <button className="primaryButton"><Play size={17} /> 進入夜班</button>
        {error && <p className="errorText">{error}</p>}
      </form>
    </main>
  );
}

function TopBar({ state, me, privateState, onReady, onStart }: { state: GameState; me?: any; privateState: PrivatePlayerState | null; onReady: () => void; onStart: () => void }) {
  const remaining = state.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000)) : 0;
  return (
    <header className="topBar">
      <div>
        <strong>{state.phase}</strong>
        <span>{state.status} · {remaining}s · 工作進度 {state.workProgress}%</span>
      </div>
      <div className="privateRule">
        <Eye size={16} />
        <span>{privateState?.privateRule.title || "尚未分配規則"}：{privateState?.privateRule.text || "開始遊戲後取得私人規則"}</span>
      </div>
      <button className="ghostButton" onClick={onReady}><ShieldAlert size={17} /> {me?.ready ? "取消準備" : "準備"}</button>
      <button className="primaryButton" onClick={onStart}><Play size={17} /> 開始</button>
    </header>
  );
}

function GameCanvas({ state, meId, onMove }: { state: GameState; meId: string; onMove: (dx: number, dy: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const me = state.players.find((player) => player.id === meId);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0b1018";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#151b26";
    ctx.fillRect(54, 26, 872, 508);
    ctx.fillStyle = "#263342";
    for (let x = 42; x < 940; x += 14) ctx.fillRect(x, 14, 7, 534);
    for (let y = 14; y < 552; y += 14) ctx.fillRect(42, y, 898, 7);
    ctx.fillStyle = "#10151f";
    ctx.fillRect(72, 54, 610, 420);
    ctx.fillRect(704, 54, 178, 420);
    ctx.fillStyle = "#33475b";
    ctx.fillRect(682, 54, 22, 420);
    ctx.fillRect(430, 474, 118, 44);
    ctx.fillStyle = "#1a2430";
    ctx.fillRect(704, 244, 178, 20);
    ctx.fillRect(704, 264, 84, 210);
    ctx.fillStyle = "#20364a";
    ctx.fillRect(280, 262, 342, 162);
    ctx.fillStyle = "#182838";
    for (let x = 294; x < 604; x += 26) for (let y = 276; y < 408; y += 22) ctx.fillRect(x, y, 8, 6);
    ctx.fillStyle = "#6d2833";
    ctx.fillRect(418, 322, 38, 28);
    ctx.fillRect(468, 328, 26, 22);
    ctx.fillStyle = "#23354a";
    ctx.fillRect(208, 64, 130, 82);
    ctx.fillStyle = "#0c1119";
    ctx.fillRect(220, 76, 34, 24);
    ctx.fillRect(268, 76, 34, 24);
    ctx.fillRect(220, 110, 34, 24);
    ctx.fillRect(268, 110, 34, 24);
    ctx.fillStyle = "#6e3038";
    ctx.fillRect(360, 142, 116, 72);
    ctx.fillStyle = "#8c3d49";
    ctx.fillRect(372, 156, 92, 44);
    ctx.fillStyle = "#c5b18e";
    ctx.fillRect(316, 154, 38, 42);
    ctx.fillRect(482, 154, 38, 42);
    ctx.fillStyle = "#51383a";
    ctx.fillRect(596, 58, 88, 96);
    ctx.strokeStyle = "#c6aa83";
    ctx.lineWidth = 3;
    ctx.strokeRect(612, 82, 52, 58);
    ctx.fillStyle = "#78605d";
    ctx.fillRect(94, 354, 180, 80);
    ctx.fillStyle = "#0d1219";
    ctx.fillRect(116, 372, 136, 40);
    ctx.fillStyle = "#a27562";
    ctx.fillRect(124, 382, 12, 12);
    ctx.fillRect(150, 382, 12, 12);
    ctx.fillRect(176, 382, 12, 12);
    ctx.fillStyle = "#242f3e";
    ctx.fillRect(748, 96, 86, 88);
    ctx.fillStyle = "#9d2f45";
    ctx.fillRect(736, 250, 54, 94);
    ctx.fillStyle = "#61849a";
    ctx.fillRect(790, 250, 78, 94);
    ctx.fillStyle = "#4c2631";
    ctx.fillRect(814, 358, 46, 90);
    ctx.strokeStyle = "#a4364c";
    ctx.lineWidth = 6;
    ctx.strokeRect(812, 354, 50, 96);
    ctx.fillStyle = "#0b0f16";
    ctx.fillRect(436, 512, 106, 20);
    ctx.fillStyle = "#8d6b55";
    ctx.fillRect(108, 220, 130, 42);
    ctx.fillStyle = "#d0b68b";
    ctx.fillRect(120, 232, 22, 12);
    ctx.fillRect(154, 232, 22, 12);
    ctx.fillRect(188, 232, 22, 12);
    ctx.fillStyle = "#223347";
    ctx.fillRect(90, 104, 84, 84);
    ctx.fillStyle = "#101822";
    for (let y = 116; y < 174; y += 18) {
      ctx.fillRect(102, y, 18, 10);
      ctx.fillRect(134, y, 18, 10);
    }
    ctx.fillStyle = "#47596c";
    ctx.fillRect(336, 96, 96, 34);
    ctx.fillRect(336, 430, 96, 26);
    ctx.fillStyle = "#111720";
    ctx.fillRect(350, 104, 68, 12);
    ctx.fillRect(352, 438, 64, 8);
    ctx.fillStyle = "#2f3b4c";
    for (let x = 270; x < 610; x += 66) {
      ctx.fillRect(x, 438, 42, 28);
      ctx.fillStyle = "#c0b18c";
      ctx.fillRect(x + 8, 446, 14, 8);
      ctx.fillStyle = "#2f3b4c";
    }
    ctx.fillStyle = "#562a36";
    ctx.fillRect(540, 106, 34, 96);
    ctx.fillStyle = "#b7a475";
    ctx.fillRect(548, 120, 18, 64);
    ctx.fillStyle = "#1c2735";
    for (let y = 78; y < 206; y += 28) {
      ctx.fillRect(642, y, 28, 16);
      ctx.fillRect(646, y + 18, 20, 4);
    }
    ctx.fillStyle = "#354a58";
    ctx.fillRect(748, 110, 72, 54);
    ctx.fillStyle = "#8e3445";
    ctx.fillRect(760, 124, 48, 20);
    ctx.fillStyle = "#d5c99f";
    ctx.fillRect(830, 102, 22, 32);
    ctx.fillStyle = "#33212a";
    ctx.fillRect(720, 388, 44, 52);
    ctx.fillRect(772, 388, 44, 52);
    ctx.fillStyle = "#bc9f72";
    ctx.fillRect(730, 400, 14, 12);
    ctx.fillRect(782, 400, 14, 12);
    ctx.fillStyle = "#263d42";
    ctx.fillRect(850, 220, 20, 20);
    ctx.fillRect(864, 206, 12, 36);
    ctx.fillStyle = "#5b8a75";
    ctx.fillRect(854, 212, 8, 8);
    ctx.fillRect(866, 198, 8, 8);
    ctx.fillStyle = "#0b0f16";
    ctx.fillRect(436, 512, 106, 20);
    ctx.fillStyle = "#c8bd63";
    ctx.font = "12px monospace";
    ctx.fillText("Lobby", 292, 250);
    ctx.fillText("Records", 214, 54);
    ctx.fillText("Meeting", 350, 254);
    ctx.fillText("IT Room", 88, 346);
    ctx.fillText("Pantry", 714, 236);
    ctx.fillText("Boss Office", 722, 86);
    ctx.fillText("Finance", 724, 362);
    ctx.fillText("Exit", 472, 506);
    if (state.activeSabotages.some((entry) => entry.sabotageId === "lights-out")) {
      ctx.fillStyle = "rgba(0,0,0,.56)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    state.players.forEach((player) => {
      const body = player.isBoss ? "#d85c55" : player.id === meId ? "#e0d567" : "#7ac6ff";
      ctx.fillStyle = "#121212";
      ctx.fillRect(player.x - 8, player.y - 15, 16, 25);
      ctx.fillStyle = body;
      ctx.fillRect(player.x - 6, player.y - 12, 12, 14);
      ctx.fillStyle = "#f0c58c";
      ctx.fillRect(player.x - 5, player.y - 21, 10, 9);
      ctx.fillStyle = body;
      ctx.fillRect(player.x - 10, player.y - 8, 4, 10);
      ctx.fillRect(player.x + 6, player.y - 8, 4, 10);
      ctx.fillRect(player.x - 5, player.y + 2, 4, 10);
      ctx.fillRect(player.x + 1, player.y + 2, 4, 10);
      if (!player.alive) {
        ctx.strokeStyle = "#111";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(player.x - 10, player.y - 10);
        ctx.lineTo(player.x + 10, player.y + 10);
        ctx.moveTo(player.x + 10, player.y - 10);
        ctx.lineTo(player.x - 10, player.y + 10);
        ctx.stroke();
      }
      ctx.fillStyle = "#f7f2e8";
      ctx.font = "12px system-ui";
      ctx.fillText(player.name, player.x - 22, player.y - 18);
    });
  }, [state, meId]);

  useEffect(draw, [draw]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const keyMap: Record<string, [number, number]> = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      const delta = keyMap[event.key];
      if (delta) onMove(delta[0], delta[1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onMove]);

  return (
    <div className="canvasWrap">
      <canvas ref={canvasRef} width={980} height={590} />
      <div className="locationBadge">{me?.currentArea || "Reception"}</div>
    </div>
  );
}

function ActionPanel({ state, meId, content, privateState, isBoss, emit }: { state: GameState; meId: string; content: Content; privateState: PrivatePlayerState | null; isBoss: boolean; emit: <T>(event: string, payload: Record<string, unknown>) => Promise<T> }) {
  const me = state.players.find((player) => player.id === meId);
  const availableTasks = content.tasks.filter((task) => task.area === me?.currentArea);
  const [targetId, setTargetId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const bossEnergy = privateState?.bossState?.sabotageEnergy ?? 0;

  return (
    <aside className="actionPanel">
      <section>
        <h2><BriefcaseBusiness size={18} /> 任務</h2>
        {availableTasks.map((task) => (
          <button key={task.id} className="actionButton" onClick={() => emit("start_task", { roomId: state.roomId, taskId: task.id })}>
            <span>{task.name}</span><small>{task.score} 分 · {task.duration}s</small>
          </button>
        ))}
        {!availableTasks.length && <p className="muted">目前區域沒有任務。</p>}
      </section>
      {isBoss && (
        <section>
          <h2><Zap size={18} /> 干擾 · {bossEnergy}</h2>
          {content.sabotages.map((sabotage) => (
            <button key={sabotage.id} className="actionButton danger" onClick={() => emit("boss_use_sabotage", { roomId: state.roomId, sabotageId: sabotage.id, targetId: state.players.find((p) => p.id !== meId)?.id, area: me?.currentArea })}>
              <span>{sabotage.name}</span><small>{sabotage.energyCost} 能量</small>
            </button>
          ))}
        </section>
      )}
      <section>
        <h2><ShieldAlert size={18} /> 規則推理</h2>
        <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
          <option value="">選擇目標</option>
          {state.players.filter((player) => player.id !== meId).map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}
        </select>
        <select value={ruleId} onChange={(event) => setRuleId(event.target.value)}>
          <option value="">猜測規則</option>
          {content.rules.map((rule) => <option value={rule.id} key={rule.id}>{rule.title}</option>)}
        </select>
        <button className="primaryButton" disabled={!targetId || !ruleId} onClick={() => emit("guess_rule", { roomId: state.roomId, targetId, guessedRuleId: ruleId })}>提交猜測</button>
      </section>
      <section>
        <h2>即時紀錄</h2>
        <div className="logList">{state.logs.slice(0, 8).map((log, index) => <p key={`${log}-${index}`}>{log}</p>)}</div>
      </section>
    </aside>
  );
}

function ChatPanel({ state, emit }: { state: GameState; emit: <T>(event: string, payload: Record<string, unknown>) => Promise<T> }) {
  const [message, setMessage] = useState("");
  return (
    <aside className="chatPanel">
      <h2><MessageSquare size={18} /> 通訊</h2>
      <div className="chatList">
        {state.chat.map((chat) => <p key={chat.id}><strong>{chat.senderName}</strong>{chat.message}</p>)}
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (message.trim()) emit("game_chat_message", { roomId: state.roomId, message }).then(() => setMessage(""));
      }}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="交換線索或試探規則" />
        <button className="primaryButton">送出</button>
      </form>
    </aside>
  );
}

const rootElement = document.getElementById("root")!;
const hotData = import.meta.hot?.data as { root?: Root } | undefined;
const root = hotData?.root || createRoot(rootElement);
if (hotData) hotData.root = root;
root.render(<App />);
