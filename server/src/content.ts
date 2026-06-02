import type { CharacterSkin, EmployeeRole, Rule, Sabotage, SpiritualEvent, TaskDef } from "@rule-company/shared";

export const areas = [
  "Reception",
  "Accounting",
  "Archive",
  "Meeting Room",
  "Server Room",
  "Break Room",
  "Executive Office",
  "Exit Gate"
];

export const rules: Rule[] = [
  { id: "rule-001", title: "保持隊形", text: "工作階段開始後 10 秒內不要單獨離開大廳。", category: "movement", difficulty: 2 },
  { id: "rule-002", title: "不要直視主管門", text: "經過主管辦公室時不可停留在門前。", category: "area", difficulty: 2 },
  { id: "rule-003", title: "紅燈靜音", text: "紅燈事件發生時，5 秒內不要傳送聊天訊息。", category: "event", difficulty: 3 },
  { id: "rule-004", title: "會議不回頭", text: "會議室內移動時不可連續往反方向走。", category: "meeting", difficulty: 2 },
  { id: "rule-005", title: "檔案室禁跑", text: "進入檔案室後 15 秒內不可使用衝刺或快速移動。", category: "area", difficulty: 3 },
  { id: "rule-006", title: "最後工時", text: "final_work 階段不可開始新任務。", category: "phase", difficulty: 2 },
  { id: "rule-007", title: "主管監聽", text: "主管辦公室附近聊天會暴露自己的規則。", category: "chat", difficulty: 4 },
  { id: "rule-008", title: "準點打卡", text: "每個工作階段前 20 秒要完成至少一個任務。", category: "phase", difficulty: 3 },
  { id: "rule-009", title: "房間禁言", text: "同一房間內超過 20 秒不可聊天。", category: "boss", difficulty: 4 },
  { id: "rule-010", title: "咖啡禁令", text: "茶水間發生靈異事件時不可完成任務。", category: "event", difficulty: 3 },
  { id: "rule-011", title: "檔案歸位", text: "完成檔案室任務後必須前往接待大廳。", category: "task", difficulty: 2 },
  { id: "rule-012", title: "玻璃眼神", text: "會議室內不可停留超過 30 秒。", category: "area", difficulty: 3 },
  { id: "rule-013", title: "伺服器低溫", text: "伺服器室任務失敗會額外扣 1 心。", category: "task", difficulty: 4 },
  { id: "rule-014", title: "封鎖門禁", text: "被鎖門干擾後 10 秒內不可進入出口。", category: "sabotage", difficulty: 4 },
  { id: "rule-015", title: "假任務陷阱", text: "看見不在任務清單的工作項目時不可開始。", category: "sabotage", difficulty: 3 },
  { id: "rule-016", title: "逃生順序", text: "逃生階段必須先到接待大廳再前往出口。", category: "escape", difficulty: 2 },
  { id: "rule-017", title: "會議發言", text: "會議中不能連續投同一個人兩次。", category: "meeting", difficulty: 3 },
  { id: "rule-018", title: "白紙黑字", text: "財務室任務完成後 12 秒內不能聊天。", category: "task", difficulty: 3 },
  { id: "rule-019", title: "廣播恐慌", text: "廣播干擾發生時不要離開目前房間。", category: "sabotage", difficulty: 2 },
  { id: "rule-020", title: "主管巡視", text: "主管巡視時不可進入主管辦公室。", category: "sabotage", difficulty: 3 }
];

export const tasks: TaskDef[] = [
  {
    id: "task-archive-sort",
    name: "整理異常檔案",
    area: "Archive",
    duration: 11,
    score: 14,
    kind: "sorting",
    description: "把被標記成紅色的異常檔案放回正確櫃位，避免主管查帳時觸發警報。",
    objective: "完成三段檔案分類，維持檔案室秩序。",
    steps: ["前往檔案室", "確認檔案標籤", "依紅、黑、白三類歸檔", "送出歸檔紀錄"],
    risk: "若燈光干擾發生，分類時間會變得更難判斷。"
  },
  {
    id: "task-ledger",
    name: "核對黑色帳本",
    area: "Accounting",
    duration: 10,
    score: 12,
    kind: "sequence",
    description: "逐項核對帳本上的金額與簽章，找出不該存在的支出紀錄。",
    objective: "依序完成帳本、憑證、主管簽章三項核對。",
    steps: ["前往財務室", "核對帳本頁碼", "比對收據金額", "確認主管簽章"],
    risk: "財務室內完成任務後要留意私人規則與聊天限制。"
  },
  {
    id: "task-server",
    name: "重啟伺服器",
    area: "Server Room",
    duration: 13,
    score: 16,
    kind: "timing",
    description: "依照機房燈號順序重啟伺服器，讓公司系統恢復工作進度。",
    objective: "在冷卻完成前穩定伺服器。",
    steps: ["前往伺服器室", "關閉異常程序", "等待藍燈穩定", "重新啟動主機"],
    risk: "伺服器低溫事件期間失敗風險更高。"
  },
  {
    id: "task-copies",
    name: "影印保密文件",
    area: "Reception",
    duration: 8,
    score: 10,
    kind: "memory",
    description: "記住文件順序並完成影印，不能把禁止外流的頁面夾到一般報表裡。",
    objective: "完成一份正確排序的保密文件。",
    steps: ["前往接待大廳", "記住文件排序", "啟動影印機", "交回封存文件"],
    risk: "印表機靈異事件會讓接待大廳任務變慢。"
  },
  {
    id: "task-coffee",
    name: "沖泡主管咖啡",
    area: "Break Room",
    duration: 7,
    score: 8,
    kind: "timing",
    description: "按照主管留下的杯溫與濃度要求完成咖啡，爭取下一段工作時間。",
    objective: "在正確時間點完成沖泡。",
    steps: ["前往茶水間", "選擇黑咖啡粉", "等待溫度落在安全區間", "放到指定托盤"],
    risk: "茶水間有事件時可能不允許完成任務。"
  },
  {
    id: "task-minutes",
    name: "補交會議紀錄",
    area: "Meeting Room",
    duration: 9,
    score: 12,
    kind: "sequence",
    description: "把缺漏的會議紀錄依時間線補齊，避免會議室留下錯誤證詞。",
    objective: "完成會議時間、發言人、決議三段補登。",
    steps: ["前往會議室", "整理錄音片段", "補上缺漏發言", "提交會議紀錄"],
    risk: "會議室停留過久可能違反私人規則。"
  }
];

export const employeeRoles: EmployeeRole[] = [
  { id: "role-auditor", name: "稽核員", description: "完成任務時會得到額外分數。", activeSkill: "短暫顯示附近任務", passiveSkill: "任務分數 +10%", cooldown: 45 },
  { id: "role-engineer", name: "維修工程師", description: "能更快解除干擾。", activeSkill: "移除所在區域干擾", passiveSkill: "伺服器室任務 +15%", cooldown: 55 },
  { id: "role-clerk", name: "行政總務", description: "移動穩定，適合支援隊友。", activeSkill: "替附近員工恢復 1 心", passiveSkill: "受到緩速影響較低", cooldown: 70 },
  { id: "role-analyst", name: "資料分析員", description: "擅長判斷他人規則。", activeSkill: "查看目標規則分類提示", passiveSkill: "猜錯懲罰降低", cooldown: 80 }
];

export const sabotages: Sabotage[] = [
  { id: "trip", name: "絆倒", description: "讓一名員工短暫緩速。", bossOnly: true, energyCost: 25, cooldown: 12, duration: 8, targetType: "player", effectType: "slow", suspicionGain: 8 },
  { id: "lights-out", name: "熄燈", description: "降低全公司視野。", bossOnly: true, energyCost: 35, cooldown: 20, duration: 12, targetType: "global", effectType: "darkness", suspicionGain: 10 },
  { id: "fake-task", name: "假任務", description: "在目前區域放置假任務干擾員工。", bossOnly: true, energyCost: 30, cooldown: 18, duration: 20, targetType: "room", effectType: "fake_task", suspicionGain: 12 },
  { id: "lock-door", name: "門禁鎖定", description: "短暫封鎖一個房間出口。", bossOnly: true, energyCost: 40, cooldown: 26, duration: 10, targetType: "room", effectType: "lock", suspicionGain: 15 },
  { id: "broadcast", name: "異常廣播", description: "讓員工恐慌並干擾判斷。", bossOnly: true, energyCost: 35, cooldown: 24, duration: 6, targetType: "global", effectType: "panic", suspicionGain: 14 }
];

export const spiritualEvents: SpiritualEvent[] = [
  { id: "red-lights", name: "紅燈巡查", description: "公司照明轉紅，行動需要更小心。", duration: 25, effectType: "red_light" },
  { id: "printer-laugh", name: "印表機笑聲", description: "接待大廳和檔案室任務變慢。", duration: 22, effectType: "printer_noise" },
  { id: "cold-server", name: "伺服器低溫", description: "伺服器室變得危險但分數提高。", duration: 26, effectType: "cold_server" },
  { id: "phantom-meeting", name: "幽靈會議", description: "玩家會被迫進入會議節奏。", duration: 18, effectType: "force_meeting" },
  { id: "exit-whisper", name: "出口低語", description: "出口會顯示不可靠的提示。", duration: 20, effectType: "exit_hint" }
];

export const shopItems = [
  { id: "item-flashlight", name: "備用手電筒", description: "遊戲中使用，可以解除一次熄燈干擾。", price: 120, effectType: "resist_darkness", available: true },
  { id: "item-badge", name: "臨時門禁卡", description: "遊戲中使用，可以解除目前區域的門禁鎖定。", price: 180, effectType: "unlock_once", available: true },
  { id: "item-coffee", name: "黑咖啡", description: "遊戲中使用，下一個任務完成速度小幅提升。", price: 90, effectType: "task_boost", available: true }
];

export const characterSkins: CharacterSkin[] = [
  {
    id: "skin-night-clerk",
    name: "夜班總務",
    description: "標準員工形象，適合新手辨識。",
    imageUrl: "/skins/night-clerk.png",
    price: 60,
    available: true,
    faction: "employee"
  },
  {
    id: "skin-red-boss",
    name: "紅領主管",
    description: "老闆陣營形象，帶有明顯紅色識別。",
    imageUrl: "/skins/red-boss.png",
    price: 250,
    available: true,
    faction: "boss"
  }
];
