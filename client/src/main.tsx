import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import {
  BriefcaseBusiness,
  ClipboardList,
  DoorOpen,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  MessageSquare,
  Package,
  Play,
  RadioTower,
  ShieldAlert,
  ShoppingBag,
  UserPlus,
  Users,
  Zap
} from "lucide-react";
import type {
  AuthUser,
  CharacterSkin,
  DoorState,
  EmployeeRole,
  GameConfig,
  GameState,
  PrivatePlayerState,
  RoomSummary,
  Rule,
  Sabotage,
  TaskDef
} from "@rule-company/shared";
import "./styles.css";

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);
const socketUrl = import.meta.env.VITE_SOCKET_URL || apiUrl;
const authStorageKey = "rule-company-auth";

type AuthState = { user: AuthUser; token: string };
type ShopItem = { id: string; name: string; description: string; price: number; effectType: string; available: boolean };
type InventoryEntry = { id: string; itemId: string; quantity: number; item?: ShopItem | CharacterSkin };
type AdminCollection = keyof Omit<Content, "gameConfig"> | "gameConfig";
type AppPage = "lobby" | "match" | "map" | "tasks" | "chat" | "shop" | "admin";

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

const emptyContent: Content = {
  rules: [],
  tasks: [],
  employeeRoles: [],
  sabotages: [],
  spiritualEvents: [],
  shopItems: [],
  characterSkins: []
};

function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const raw = localStorage.getItem(authStorageKey);
    return raw ? JSON.parse(raw) : null;
  });
  const [content, setContent] = useState<Content>(emptyContent);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [state, setState] = useState<GameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [page, setPage] = useState<AppPage>("lobby");
  const [notice, setNotice] = useState("連線準備中");

  const me = state?.players.find((player) => player.id === auth?.user.id);
  const isBoss = privateState?.faction === "boss";
  const selectedRoomSummary = rooms.find((room) => room.id === selectedRoom || room.code === selectedRoom);
  const canOpenAdmin = !!auth && (auth.user.isAdmin || import.meta.env.DEV);

  useEffect(() => {
    fetch(`${apiUrl}/api/content`)
      .then((res) => res.json())
      .then(setContent)
      .catch(() => setNotice("內容載入失敗"));
  }, []);

  useEffect(() => {
    if (!auth) return;
    localStorage.setItem(authStorageKey, JSON.stringify(auth));
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

  useEffect(() => {
    setPage((current) => {
      if (!state) return current === "shop" || (current === "admin" && canOpenAdmin) ? current : "lobby";
      if (state.status === "waiting") return current === "shop" || (current === "admin" && canOpenAdmin) ? current : "match";
      if (current === "lobby" || current === "match") return "map";
      if (current === "admin" && !canOpenAdmin) return "map";
      return current;
    });
  }, [canOpenAdmin, state?.status]);

  async function refreshRooms() {
    const data = await fetch(`${apiUrl}/api/rooms`).then((res) => res.json());
    setRooms(data.rooms || []);
  }

  async function createRoom() {
    if (!auth) return;
    const res = await fetch(`${apiUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ name: "夜班辦公室" })
    });
    const data = await res.json();
    setState(data.state);
    setPrivateState(null);
    setSelectedRoom(data.state.roomCode || data.state.roomId);
    setJoinCode(data.state.roomCode || "");
    setPage("match");
    join(data.state.roomId);
  }

  function emit<T>(event: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve) => {
      socket?.emit(event, payload, (reply: any) => {
        if (!reply?.ok) {
          setNotice(reply?.error || "操作失敗");
          resolve(reply);
          return;
        }
        setNotice("操作完成");
        resolve(reply);
      });
    });
  }

  function join(roomId = selectedRoom) {
    if (!socket || !roomId) return;
    socket.emit("join_room", { roomId }, (reply: any) => {
      if (!reply.ok) {
        setNotice(reply.error);
        return;
      }
      setState(reply.state);
      setPrivateState(reply.privateState);
      setSelectedRoom(reply.state?.roomCode || reply.state?.roomId || roomId);
      setJoinCode(reply.state?.roomCode || "");
      setPage(reply.state?.status === "waiting" ? "match" : "map");
      setNotice("已進入房間");
    });
  }

  function updateAuth(next: AuthState) {
    localStorage.setItem(authStorageKey, JSON.stringify(next));
    setAuth(next);
  }

  if (!auth) return <AuthPanel onAuth={updateAuth} />;

  const navItems: Array<{ page: AppPage; label: string; icon: React.ReactNode; show: boolean }> = [
    { page: "lobby", label: "主大廳", icon: <Users size={17} />, show: true },
    { page: "match", label: "匹配", icon: <RadioTower size={17} />, show: state?.status === "waiting" },
    { page: "map", label: "地圖", icon: <DoorOpen size={17} />, show: !!state && state.status !== "waiting" },
    { page: "tasks", label: "任務 / 背包", icon: <Package size={17} />, show: !!state && state.status !== "waiting" },
    { page: "chat", label: "聊天", icon: <MessageSquare size={17} />, show: !!state && state.status !== "waiting" },
    { page: "shop", label: "商店", icon: <ShoppingBag size={17} />, show: true },
    { page: "admin", label: "後台", icon: <ShieldAlert size={17} />, show: canOpenAdmin }
  ];
  const roomCode = state?.roomCode || selectedRoom;
  const roomName = state?.roomCode ? `房間 ${state.roomCode}` : selectedRoomSummary?.name || "匹配房間";
  const minPlayers = selectedRoomSummary?.minPlayers || content.gameConfig?.room.minPlayers || 4;
  const showTopBar = !!state && state.status !== "waiting" && (page === "map" || page === "tasks" || page === "chat");

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
        <nav className="pageNav" aria-label="主要頁面">
          {navItems.filter((item) => item.show).map((item) => (
            <button key={item.page} className={page === item.page ? "navButton active" : "navButton"} onClick={() => setPage(item.page)}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebarActions">
          <button className="primaryButton" onClick={() => { setPage("lobby"); createRoom(); }}><DoorOpen size={17} /> 建立房間</button>
          <button className="ghostButton" onClick={() => { setPage("lobby"); join(joinCode); }} disabled={joinCode.trim().length < 6}><RadioTower size={17} /> 加入房間</button>
        </div>
        <div className="notice">{notice}</div>
      </aside>

      <section className="playSurface">
        {page === "shop" ? (
          <ShopPanel auth={auth} onAuth={updateAuth} />
        ) : page === "admin" && canOpenAdmin ? (
          <AdminPanel auth={auth} />
        ) : page === "lobby" || !state ? (
          <MainLobbyScreen roomCode={joinCode} onRoomCode={setJoinCode} onCreate={createRoom} onJoin={() => join(joinCode)} />
        ) : state.status === "waiting" ? (
          <MatchmakingScreen
            state={state}
            meId={auth.user.id}
            roomName={roomName}
            roomCode={roomCode}
            minPlayers={minPlayers}
            onReady={() => emit("player_ready", { roomId: state.roomId })}
            onStart={() => emit("start_match", { roomId: state.roomId })}
          />
        ) : (
          <div className="pageStack">
            {showTopBar && (
              <TopBar
                state={state}
                me={me}
                privateState={privateState}
                onReady={() => emit("player_ready", { roomId: state.roomId })}
                onStart={() => emit("start_match", { roomId: state.roomId })}
                gameConfig={content.gameConfig}
              />
            )}
            {page === "tasks" ? (
              <ActionPanel state={state} meId={auth.user.id} content={content} privateState={privateState} isBoss={isBoss} auth={auth} emit={emit} />
            ) : page === "chat" ? (
              <ChatPanel state={state} emit={emit} />
            ) : (
              <div className="mapPage">
              <GameCanvas
                state={state}
                meId={auth.user.id}
                tasks={content.tasks}
                onMove={(dx, dy) => emit("player_move", { roomId: state.roomId, dx, dy })}
                onInteract={(taskId) => emit("start_task", { roomId: state.roomId, taskId })}
                onToggleDoor={(doorId) => emit("toggle_door", { roomId: state.roomId, doorId })}
              />
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function MainLobbyScreen({ roomCode, onRoomCode, onCreate, onJoin }: { roomCode: string; onRoomCode: (value: string) => void; onCreate: () => void; onJoin: () => void }) {
  return (
    <div className="lobbyScreen">
      <header>
        <div>
          <span>MAIN LOBBY</span>
          <h2>主大廳</h2>
          <p>建立房間後會得到 6 位數代號。只有知道代號的人才能加入同一間房，不會顯示其他匹配房間。</p>
        </div>
        <div className="lobbyActions">
          <button className="primaryButton" onClick={onCreate}><DoorOpen size={17} /> 建立房間</button>
        </div>
      </header>
      <form className="joinCodePanel" onSubmit={(event) => { event.preventDefault(); onJoin(); }}>
        <label>
          <span>房間代號</span>
          <input
            value={roomCode}
            onChange={(event) => onRoomCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="輸入 6 位數代號"
            maxLength={6}
          />
        </label>
        <button className="primaryButton" disabled={roomCode.trim().length < 6}><RadioTower size={17} /> 加入房間</button>
      </form>
    </div>
  );
}

function MatchmakingScreen({ state, meId, roomName, roomCode, minPlayers, onReady, onStart }: { state: GameState; meId: string; roomName: string; roomCode?: string; minPlayers: number; onReady: () => void; onStart: () => void }) {
  const me = state.players.find((player) => player.id === meId);
  const readyCount = state.players.filter((player) => player.ready).length;
  const effectiveMinPlayers = state.players.some((player) => player.isBot) ? Math.min(minPlayers, state.players.length) : minPlayers;
  const allHumanReady = state.players.filter((player) => !player.isBot).every((player) => player.ready);
  const canStart = state.players.length >= effectiveMinPlayers && allHumanReady;
  return (
    <div className="matchmakingScreen">
      <header>
        <span>MATCHMAKING</span>
        <h2><Users size={22} /> {roomName}</h2>
        {roomCode && <strong className="roomCodeBadge">代號 {roomCode}</strong>}
        <p>等待玩家加入並準備。遊戲開始後，才會進入正式公司地圖、任務與背包畫面。</p>
      </header>
      <div className="matchStats">
        <div><strong>{state.players.length}</strong><span>目前人數</span></div>
        <div><strong>{readyCount}</strong><span>已準備</span></div>
        <div><strong>{effectiveMinPlayers}</strong><span>開始門檻</span></div>
      </div>
      <div className="matchPlayers">
        {state.players.map((player) => (
          <article key={player.id} className={player.id === meId ? "matchPlayer self" : "matchPlayer"}>
            <strong>{player.name}</strong>
            <span>{player.isBot ? "自動補位 · " : ""}{player.ready ? "已準備" : "等待中"}</span>
          </article>
        ))}
      </div>
      <div className="matchActions">
        <button className="ghostButton" onClick={onReady}><ShieldAlert size={17} /> {me?.ready ? "取消準備" : "準備"}</button>
        <button className="primaryButton" disabled={!canStart} onClick={onStart}><Play size={17} /> 開始遊戲</button>
      </div>
    </div>
  );
}

function ShopPanel({ auth, onAuth }: { auth: AuthState; onAuth: (auth: AuthState) => void }) {
  const [items, setItems] = useState<Array<ShopItem | CharacterSkin>>([]);
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
    onAuth(nextAuth);
    setStatus(`已購買 ${data.item.name}`);
  }

  return (
    <section className="shopPage">
      <header>
        <div>
          <h2>商店</h2>
          <span>目前金幣 {auth.user.coins}</span>
        </div>
        <button className="ghostButton" onClick={loadShop}><ShoppingBag size={16} /> 更新商品</button>
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
      {!items.length && <p className="muted">目前沒有可購買商品。</p>}
        {status && <span className="shopStatus">{status}</span>}
    </section>
  );
}

function AdminPanel({ auth }: { auth: AuthState }) {
  const [collection, setCollection] = useState<AdminCollection>("gameConfig");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [json, setJson] = useState("");
  const [status, setStatus] = useState("後台可新增、修改、上下架內容");

  const load = useCallback(async () => {
    if (collection === "gameConfig") {
      const res = await fetch(`${apiUrl}/api/admin/game-config`, { headers: { Authorization: `Bearer ${auth.token}` } });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "數值載入失敗");
        return;
      }
      setItems([]);
      setSelectedId("game-config");
      setJson(JSON.stringify(data.config, null, 2));
      return;
    }
    const res = await fetch(`${apiUrl}/api/admin/content`, { headers: { Authorization: `Bearer ${auth.token}` } });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "內容載入失敗");
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
        if (!res.ok) throw new Error(data.error || "數值儲存失敗");
        setStatus("遊戲數值已儲存");
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
      setStatus("內容已儲存");
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "JSON 格式錯誤");
    }
  }

  async function remove() {
    if (collection === "gameConfig" || !selectedId) return;
    const res = await fetch(`${apiUrl}/api/admin/content/${collection}/${selectedId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    setStatus(res.ok ? "內容已刪除" : "刪除失敗");
    setSelectedId("");
    setJson(JSON.stringify(templateFor(collection), null, 2));
    await load();
  }

  async function toggleAvailable(available: boolean) {
    if (collection === "gameConfig" || !selectedId) return;
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
        <h2>後台管理</h2>
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
            <option value="gameConfig">遊戲數值</option>
            <option value="rules">規則</option>
            <option value="tasks">任務</option>
            <option value="employeeRoles">員工角色</option>
            <option value="sabotages">主管干擾</option>
            <option value="spiritualEvents">靈異事件</option>
            <option value="shopItems">商店商品</option>
            <option value="characterSkins">人物外觀</option>
          </select>
          <div className="adminTabs">
            {(["gameConfig", "tasks", "shopItems"] as AdminCollection[]).map((name) => (
              <button key={name} className={collection === name ? "selected" : ""} onClick={() => {
                setCollection(name);
                setSelectedId("");
                setJson(JSON.stringify(templateFor(name), null, 2));
              }}>{name}</button>
            ))}
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
  if (collection === "tasks") return { id: "task-new", name: "新任務", area: "Reception", duration: 10, score: 10, kind: "timing", description: "任務說明", objective: "任務目標", steps: ["步驟一", "步驟二"], risk: "任務風險" };
  if (collection === "spiritualEvents") return { id: "event-new", name: "新事件", description: "事件說明", duration: 20, effectType: "custom" };
  if (collection === "rules") return { id: "rule-new", title: "新規則", text: "規則內容", category: "custom", difficulty: 2 };
  if (collection === "employeeRoles") return { id: "role-new", name: "新角色", description: "角色說明", activeSkill: "主動技能", passiveSkill: "被動技能", cooldown: 60 };
  if (collection === "sabotages") return { id: "sabotage-new", name: "新干擾", description: "干擾說明", bossOnly: true, energyCost: 30, cooldown: 20, duration: 8, targetType: "player", effectType: "custom", suspicionGain: 10 };
  if (collection === "characterSkins") return { id: "skin-new", name: "新外觀", description: "外觀說明", imageUrl: "/skins/new.png", price: 100, available: true, faction: "employee" };
  return { id: "item-new", name: "新道具", description: "道具說明", price: 100, effectType: "custom", available: true };
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
        setStatus(data.resetToken ? `重設碼：${data.resetToken}` : "如果 Email 存在，系統已建立重設流程。");
        if (data.resetToken) setResetToken(data.resetToken);
        setMode("reset");
        return;
      }

      if (isReset) {
        if (password !== confirmPassword) throw new Error("兩次密碼不一致");
        const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token: resetToken.trim(), password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "重設密碼失敗");
        setStatus("密碼已重設，請登入。");
        setMode("login");
        return;
      }

      if (isRegister && password !== confirmPassword) throw new Error("兩次密碼不一致");
      const res = await fetch(`${apiUrl}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "登入失敗");
      onAuth(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "發生錯誤");
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
          <p>{isForgot ? "輸入 Email 取得重設密碼代碼。" : isReset ? "輸入重設碼與新密碼。" : "登入或建立帳號後進入夜班公司。"}</p>
        </div>
        {!isForgot && !isReset && (
          <div className="segmented">
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}><UserPlus size={16} /> 註冊</button>
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}><LogIn size={16} /> 登入</button>
          </div>
        )}
        {isRegister && <input value={name} onChange={(event) => setName(event.target.value)} placeholder="暱稱" autoComplete="name" required />}
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
          {loading ? "處理中..." : isForgot ? "取得重設碼" : isReset ? "重設密碼" : mode === "login" ? "登入" : "建立帳號"}
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

function TopBar({ state, me, privateState, onReady, onStart, gameConfig }: { state: GameState; me?: any; privateState: PrivatePlayerState | null; onReady: () => void; onStart: () => void; gameConfig?: GameConfig }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const remaining = state.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)) : 0;
  const phaseSeconds = gameConfig?.phases[state.phase] ?? defaultPhaseSeconds[state.phase] ?? 60;
  const clockProgress = Math.max(0, Math.min(1, remaining / Math.max(1, phaseSeconds)));
  const clockAngle = Math.round(clockProgress * 360);
  const isUrgent = remaining > 0 && remaining <= 10;
  const phaseName = phaseLabel(state.phase);
  return (
    <header className="topBar">
      <div>
        <strong>{phaseName}</strong>
        <span>{state.status} · {remaining}s · 工作進度 {state.workProgress}%</span>
      </div>
      <div className={isUrgent ? "countdownClock urgent" : "countdownClock"} aria-label={`倒數 ${remaining} 秒`}>
        <div className="clockFace" style={{ background: `conic-gradient(#f0c96a 0deg ${clockAngle}deg, #3b3932 ${clockAngle}deg 360deg)` }}>
          <span className="clockHand" />
          <strong>{remaining}</strong>
          <small>秒</small>
        </div>
      </div>
      <div className="privateRule">
        <Eye size={16} />
        <span>{privateState?.privateRule.title || "私人規則"}：{privateState?.privateRule.text || "遊戲開始後會分配私人規則。"}</span>
      </div>
      <button className="ghostButton" onClick={onReady}><ShieldAlert size={17} /> {me?.ready ? "取消準備" : "準備"}</button>
      <button className="primaryButton" onClick={onStart}><Play size={17} /> 重新開始</button>
    </header>
  );
}

const mapWorld = { width: 1400, height: 900 };
const mapRooms = [
  { x: 80, y: 70, width: 300, height: 230, color: "#1b2a3a", label: "檔案室" },
  { x: 430, y: 70, width: 340, height: 230, color: "#25364a", label: "會議室" },
  { x: 980, y: 70, width: 280, height: 230, color: "#2a2230", label: "主管辦公室" },
  { x: 80, y: 560, width: 330, height: 240, color: "#2a2f3d", label: "伺服器室" },
  { x: 440, y: 420, width: 430, height: 260, color: "#20364a", label: "大廳" },
  { x: 980, y: 380, width: 280, height: 180, color: "#244456", label: "茶水間" },
  { x: 980, y: 610, width: 280, height: 190, color: "#25201b", label: "財務室" }
];

function GameCanvas({ state, meId, tasks, onMove, onInteract, onToggleDoor }: { state: GameState; meId: string; tasks: TaskDef[]; onMove: (dx: number, dy: number) => void; onInteract: (taskId: string) => void; onToggleDoor: (doorId: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const joystickDirection = useRef<[number, number]>([0, 0]);
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const me = state.players.find((player) => player.id === meId);
  const nearbyTasks = tasks.filter((task) => task.area === me?.currentArea);
  const primaryTask = nearbyTasks[0];
  const nearestDoor = useMemo(() => {
    if (!me) return undefined;
    return state.doors
      .map((door) => ({ door, distance: Math.hypot(me.x - (door.x + door.width / 2), me.y - (door.y + door.height / 2)) }))
      .filter((entry) => entry.distance <= 125)
      .sort((a, b) => a.distance - b.distance)[0]?.door;
  }, [me, state.doors]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = "#0b1018";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const focusX = me?.x || 700;
    const focusY = me?.y || 520;
    const cameraX = clampNumber(focusX + pan.x - canvas.width / (2 * zoom), 0, mapWorld.width - canvas.width / zoom);
    const cameraY = clampNumber(focusY + pan.y - canvas.height / (2 * zoom), 0, mapWorld.height - canvas.height / zoom);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, -cameraY);
    ctx.fillStyle = "#151b26";
    ctx.fillRect(35, 35, mapWorld.width - 70, mapWorld.height - 70);
    ctx.fillStyle = "#263342";
    for (let x = 42; x < mapWorld.width - 40; x += 14) ctx.fillRect(x, 20, 7, mapWorld.height - 40);
    for (let y = 20; y < mapWorld.height - 20; y += 14) ctx.fillRect(42, y, mapWorld.width - 84, 7);

    mapRooms.forEach((entry) => room(ctx, entry.x, entry.y, entry.width, entry.height, entry.color, entry.label));
    ctx.fillStyle = "#0b0f16";
    ctx.fillRect(650, 800, 120, 34);
    ctx.fillStyle = "#c8bd63";
    ctx.font = "12px monospace";
    ctx.fillText("出口", 690, 792);

    state.doors.forEach((door) => {
      ctx.fillStyle = door.open ? "#c9a86a" : "#5e392e";
      ctx.fillRect(door.x, door.y, door.width, door.height);
      ctx.strokeStyle = door.open ? "#f0d088" : "#a4493a";
      ctx.lineWidth = 3;
      ctx.strokeRect(door.x, door.y, door.width, door.height);
    });

    ctx.fillStyle = "#6d2833";
    ctx.fillRect(615, 515, 52, 38);
    ctx.fillRect(690, 522, 36, 30);
    ctx.fillStyle = "#8d6b55";
    ctx.fillRect(140, 305, 155, 48);
    ctx.fillStyle = "#c5b18e";
    ctx.fillRect(438, 165, 42, 52);
    ctx.fillRect(650, 165, 42, 52);

    if (state.activeSabotages.some((entry) => entry.sabotageId === "lights-out")) {
      ctx.fillStyle = "rgba(0,0,0,.56)";
      ctx.fillRect(0, 0, mapWorld.width, mapWorld.height);
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
      ctx.fillText(player.isBot ? `${player.name} AI` : player.name, player.x - 22, player.y - 18);
    });
    ctx.restore();
  }, [state, meId, me, pan, zoom]);

  useEffect(draw, [draw]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const keyMap: Record<string, [number, number]> = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      const delta = keyMap[event.key];
      const target = event.target as HTMLElement | null;
      if (delta && !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target?.tagName || "")) {
        event.preventDefault();
        onMove(delta[0], delta[1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onMove]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const [dx, dy] = joystickDirection.current;
      if (dx || dy) onMove(dx, dy);
    }, 130);
    return () => window.clearInterval(interval);
  }, [onMove]);

  function updateJoystick(clientX: number, clientY: number) {
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;
    const radius = rect.width / 2;
    const rawX = clientX - rect.left - radius;
    const rawY = clientY - rect.top - radius;
    const length = Math.hypot(rawX, rawY);
    const limit = radius - 18;
    const scale = length > limit ? limit / length : 1;
    const x = rawX * scale;
    const y = rawY * scale;
    setJoystickKnob({ x, y });
    joystickDirection.current = length < 10 ? [0, 0] : [Math.abs(rawX) > 16 ? Math.sign(rawX) : 0, Math.abs(rawY) > 16 ? Math.sign(rawY) : 0];
  }

  function resetJoystick() {
    joystickDirection.current = [0, 0];
    setJoystickKnob({ x: 0, y: 0 });
  }

  return (
    <div className="canvasWrap">
      <canvas ref={canvasRef} width={980} height={590} />
      <div className="locationBadge">{areaLabel(me?.currentArea || "Reception")}</div>
      <div className="movementHint">WASD / 方向鍵移動</div>
      <div className="viewControls">
        <button type="button" onClick={() => setZoom((value) => Math.min(1.8, value + 0.15))}>+</button>
        <button type="button" onClick={() => setZoom((value) => Math.max(0.75, value - 0.15))}>-</button>
        <button type="button" onClick={() => setPan((value) => ({ ...value, y: value.y - 80 }))}>↑</button>
        <button type="button" onClick={() => setPan((value) => ({ ...value, y: value.y + 80 }))}>↓</button>
        <button type="button" onClick={() => setPan((value) => ({ ...value, x: value.x - 80 }))}>←</button>
        <button type="button" onClick={() => setPan((value) => ({ ...value, x: value.x + 80 }))}>→</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>置中</button>
      </div>
      {nearestDoor ? (
        <button className="interactButton" onClick={() => onToggleDoor(nearestDoor.id)}>
          <ClipboardList size={17} />
          {nearestDoor.open ? "關門" : "開門"}：{nearestDoor.name}
        </button>
      ) : primaryTask && (
        <button className="interactButton" onClick={() => onInteract(primaryTask.id)}>
          <ClipboardList size={17} />
          互動：{primaryTask.name}
        </button>
      )}
      <div
        className="mobileJoystick"
        ref={joystickRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateJoystick(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateJoystick(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          resetJoystick();
        }}
        onPointerCancel={resetJoystick}
      >
        <span style={{ transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)` }} />
      </div>
    </div>
  );
}

function room(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, label: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#0d1118";
  ctx.lineWidth = 5;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#c8bd63";
  ctx.font = "12px monospace";
  ctx.fillText(label, x + 14, y + 24);
}

function areaLabel(area: string) {
  const labels: Record<string, string> = {
    Reception: "接待大廳",
    Accounting: "財務室",
    Archive: "檔案室",
    "Meeting Room": "會議室",
    "Server Room": "伺服器室",
    "Break Room": "茶水間",
    "Executive Office": "主管辦公室",
    "Exit Gate": "出口"
  };
  return labels[area] || area;
}

function taskKindLabel(kind: TaskDef["kind"]) {
  const labels: Record<TaskDef["kind"], string> = {
    sequence: "順序",
    memory: "記憶",
    timing: "時機",
    sorting: "分類"
  };
  return labels[kind];
}

function clampNumber(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function ActionPanel({ state, meId, content, privateState, isBoss, auth, emit }: { state: GameState; meId: string; content: Content; privateState: PrivatePlayerState | null; isBoss: boolean; auth: AuthState; emit: <T>(event: string, payload: Record<string, unknown>) => Promise<T> }) {
  const me = state.players.find((player) => player.id === meId);
  const availableTasks = content.tasks.filter((task) => task.area === me?.currentArea);
  const [targetId, setTargetId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [bagStatus, setBagStatus] = useState("");
  const bossEnergy = privateState?.bossState?.sabotageEnergy ?? 0;
  const usableInventory = inventory.filter((entry) => !entry.item || !("imageUrl" in entry.item));

  const loadInventory = useCallback(async () => {
    const res = await fetch(`${apiUrl}/api/shop/inventory`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    const data = await res.json();
    setInventory(data.inventory || []);
  }, [auth.token]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  async function useItem(entry: InventoryEntry) {
    const reply: any = await emit("use_inventory_item", { roomId: state.roomId, itemId: entry.itemId, inventoryId: entry.id });
    setBagStatus(reply?.ok ? `已使用 ${entry.item?.name || entry.itemId}` : reply?.error || "使用失敗");
    if (reply?.ok) await loadInventory();
  }

  return (
    <aside className="actionPanel">
      <section>
        <h2><BriefcaseBusiness size={18} /> 任務</h2>
        {availableTasks.map((task) => (
          <article key={task.id} className="taskDetailCard">
            <header>
              <div>
                <strong>{task.name}</strong>
                <span>{areaLabel(task.area)} · {taskKindLabel(task.kind)}</span>
              </div>
              <b>{task.score} 分 · {task.duration}s</b>
            </header>
            <p>{task.description || "前往指定區域完成工作項目。"}</p>
            <dl>
              <div><dt>目標</dt><dd>{task.objective || "完成任務並提高工作進度。"}</dd></div>
              <div><dt>風險</dt><dd>{task.risk || "注意私人規則與主管干擾。"}</dd></div>
            </dl>
            {!!task.steps?.length && (
              <ol>
                {task.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            )}
            <button className="primaryButton" onClick={() => emit("start_task", { roomId: state.roomId, taskId: task.id })}>
              <ClipboardList size={16} /> 開始任務
            </button>
          </article>
        ))}
        {!availableTasks.length && <p className="muted">目前區域沒有任務，移動到其他辦公區查看。</p>}
      </section>
      <section>
        <h2><Package size={18} /> 背包</h2>
        <button className="ghostButton" onClick={loadInventory}>更新背包</button>
        {usableInventory.map((entry) => (
          <article key={entry.id} className="inventoryCard">
            <div>
              <strong>{entry.item?.name || entry.itemId}</strong>
              <span>剩餘 {entry.quantity}</span>
            </div>
            <p>{entry.item?.description || "已購買道具"}</p>
            <button className="ghostButton" onClick={() => useItem(entry)}>使用</button>
          </article>
        ))}
        {!usableInventory.length && <p className="muted">背包目前沒有可使用道具。</p>}
        {bagStatus && <p className="shopStatus">{bagStatus}</p>}
      </section>
      {isBoss && (
        <section>
          <h2><Zap size={18} /> 主管干擾 · {bossEnergy}</h2>
          {content.sabotages.map((sabotage) => (
            <button key={sabotage.id} className="actionButton danger" onClick={() => emit("boss_use_sabotage", { roomId: state.roomId, sabotageId: sabotage.id, targetId: state.players.find((p) => p.id !== meId)?.id, area: me?.currentArea })}>
              <span>{sabotage.name}</span><small>{sabotage.energyCost} 能量</small>
            </button>
          ))}
        </section>
      )}
      <section>
        <h2><ShieldAlert size={18} /> 規則檢舉</h2>
        <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
          <option value="">選擇玩家</option>
          {state.players.filter((player) => player.id !== meId).map((player) => <option value={player.id} key={player.id}>{player.name}</option>)}
        </select>
        <select value={ruleId} onChange={(event) => setRuleId(event.target.value)}>
          <option value="">選擇規則</option>
          {content.rules.map((rule) => <option value={rule.id} key={rule.id}>{rule.title}</option>)}
        </select>
        <button className="primaryButton" disabled={!targetId || !ruleId} onClick={() => emit("guess_rule", { roomId: state.roomId, targetId, guessedRuleId: ruleId })}>提交檢舉</button>
      </section>
      <section>
        <h2>系統紀錄</h2>
        <div className="logList">{state.logs.slice(0, 8).map((log, index) => <p key={`${log}-${index}`}>{log}</p>)}</div>
      </section>
    </aside>
  );
}

function ChatPanel({ state, emit }: { state: GameState; emit: <T>(event: string, payload: Record<string, unknown>) => Promise<T> }) {
  const [message, setMessage] = useState("");
  return (
    <aside className="chatPanel">
      <h2><MessageSquare size={18} /> 聊天</h2>
      <div className="chatList">
        {state.chat.map((chat) => <p key={chat.id}><strong>{chat.senderName}</strong>{chat.message}</p>)}
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (message.trim()) emit("game_chat_message", { roomId: state.roomId, message }).then(() => setMessage(""));
      }}>
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="輸入訊息" />
        <button className="primaryButton">送出</button>
      </form>
    </aside>
  );
}

function phaseLabel(phase: GameState["phase"]) {
  const labels: Record<GameState["phase"], string> = {
    preparation: "準備階段",
    work: "工作階段",
    meeting: "會議階段",
    event: "事件階段",
    final_work: "最後工作",
    escape: "逃生階段",
    ended: "已結束"
  };
  return labels[phase];
}

const defaultPhaseSeconds: Record<GameState["phase"], number> = {
  preparation: 25,
  work: 180,
  meeting: 60,
  event: 30,
  final_work: 150,
  escape: 60,
  ended: 0
};

const rootElement = document.getElementById("root")!;
const hotData = import.meta.hot?.data as { root?: Root } | undefined;
const root = hotData?.root || createRoot(rootElement);
if (hotData) hotData.root = root;
root.render(<App />);
