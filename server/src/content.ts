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
  { id: "rule-001", title: "禁止回頭", text: "聽到背後有人叫你時，10 秒內不要回頭。", category: "movement", difficulty: 2 },
  { id: "rule-002", title: "沉默影印", text: "影印機啟動時不要在影印室說話。", category: "area", difficulty: 2 },
  { id: "rule-003", title: "紅燈暫停", text: "辦公室燈光變紅時必須停止移動 5 秒。", category: "event", difficulty: 3 },
  { id: "rule-004", title: "會議禮節", text: "會議開始後第一句話不能指控他人。", category: "meeting", difficulty: 2 },
  { id: "rule-005", title: "不可獨處", text: "進入 Archive 後 15 秒內要靠近另一名玩家。", category: "area", difficulty: 3 },
  { id: "rule-006", title: "禁止加班", text: "final_work 階段不能開始新任務。", category: "phase", difficulty: 2 },
  { id: "rule-007", title: "低聲通行", text: "經過 Executive Office 時聊天訊息不可超過 12 字。", category: "chat", difficulty: 4 },
  { id: "rule-008", title: "整點報備", text: "每次階段轉換後 20 秒內必須送出一則訊息。", category: "phase", difficulty: 3 },
  { id: "rule-009", title: "避開主管", text: "不能連續 20 秒停在老闆附近。", category: "boss", difficulty: 4 },
  { id: "rule-010", title: "咖啡禁令", text: "Break Room 發生靈性事件時不可完成任務。", category: "event", difficulty: 3 },
  { id: "rule-011", title: "檔案歸位", text: "完成 Archive 任務後必須前往 Reception。", category: "task", difficulty: 2 },
  { id: "rule-012", title: "玻璃眼神", text: "Meeting Room 內不可停留超過 30 秒。", category: "area", difficulty: 3 },
  { id: "rule-013", title: "伺服器低溫", text: "Server Room 任務失敗會額外扣 1 心。", category: "task", difficulty: 4 },
  { id: "rule-014", title: "門禁錯覺", text: "被鎖門干擾後 10 秒內不可進入 Exit Gate。", category: "sabotage", difficulty: 4 },
  { id: "rule-015", title: "勿看監視器", text: "被監控標記時不可完成互動。", category: "sabotage", difficulty: 3 },
  { id: "rule-016", title: "下班路線", text: "escape 階段必須先經過 Reception 才能到 Exit Gate。", category: "escape", difficulty: 2 },
  { id: "rule-017", title: "冷笑話", text: "會議中不能連續兩次投同一人。", category: "meeting", difficulty: 3 },
  { id: "rule-018", title: "白紙黑字", text: "Accounting 任務完成後 12 秒內不能聊天。", category: "task", difficulty: 3 },
  { id: "rule-019", title: "主管腳步", text: "聽到恐嚇廣播時必須離開目前區域。", category: "sabotage", difficulty: 2 },
  { id: "rule-020", title: "最後一盞燈", text: "關燈期間不能靠近 Executive Office。", category: "sabotage", difficulty: 3 }
];

export const tasks: TaskDef[] = [
  { id: "task-archive-sort", name: "整理異常檔案", area: "Archive", duration: 11, score: 14, kind: "sorting" },
  { id: "task-ledger", name: "核對黑色帳本", area: "Accounting", duration: 10, score: 12, kind: "sequence" },
  { id: "task-server", name: "重啟伺服器", area: "Server Room", duration: 13, score: 16, kind: "timing" },
  { id: "task-copies", name: "影印保密文件", area: "Reception", duration: 8, score: 10, kind: "memory" },
  { id: "task-coffee", name: "沖泡主管咖啡", area: "Break Room", duration: 7, score: 8, kind: "timing" },
  { id: "task-minutes", name: "補交會議紀錄", area: "Meeting Room", duration: 9, score: 12, kind: "sequence" }
];

export const employeeRoles: EmployeeRole[] = [
  { id: "role-auditor", name: "稽核員", description: "完成任務分數增加。", activeSkill: "短暫顯示附近任務", passiveSkill: "任務得分 +10%", cooldown: 45 },
  { id: "role-engineer", name: "維修工程師", description: "能更快解除干擾。", activeSkill: "移除所在區域干擾", passiveSkill: "Server Room 任務 +15%", cooldown: 55 },
  { id: "role-clerk", name: "總務專員", description: "移動穩定，適合救場。", activeSkill: "替附近玩家恢復 1 心", passiveSkill: "被絆倒時間降低", cooldown: 70 },
  { id: "role-analyst", name: "資料分析師", description: "擅長規則推理。", activeSkill: "獲得目標規則類別提示", passiveSkill: "猜錯扣分降低", cooldown: 80 }
];

export const sabotages: Sabotage[] = [
  { id: "trip", name: "絆倒", description: "讓一名員工短暫減速。", bossOnly: true, energyCost: 25, cooldown: 12, duration: 8, targetType: "player", effectType: "slow", suspicionGain: 8 },
  { id: "lights-out", name: "關燈", description: "全場視野降低。", bossOnly: true, energyCost: 35, cooldown: 20, duration: 12, targetType: "global", effectType: "darkness", suspicionGain: 10 },
  { id: "fake-task", name: "假任務", description: "在目前區域放置假任務干擾員工。", bossOnly: true, energyCost: 30, cooldown: 18, duration: 20, targetType: "room", effectType: "fake_task", suspicionGain: 12 },
  { id: "lock-door", name: "鎖門", description: "暫時封鎖一個區域出口。", bossOnly: true, energyCost: 40, cooldown: 26, duration: 10, targetType: "room", effectType: "lock", suspicionGain: 15 },
  { id: "broadcast", name: "恐嚇廣播", description: "迫使員工離開所在區域。", bossOnly: true, energyCost: 35, cooldown: 24, duration: 6, targetType: "global", effectType: "panic", suspicionGain: 14 }
];

export const spiritualEvents: SpiritualEvent[] = [
  { id: "red-lights", name: "紅燈巡查", description: "燈光變紅，移動會提高風險。", duration: 25, effectType: "red_light" },
  { id: "printer-laugh", name: "影印機笑聲", description: "Reception 與 Archive 任務時間增加。", duration: 22, effectType: "printer_noise" },
  { id: "cold-server", name: "伺服器低溫", description: "Server Room 變得危險但分數提高。", duration: 26, effectType: "cold_server" },
  { id: "phantom-meeting", name: "幽靈會議", description: "立即進入短會議。", duration: 18, effectType: "force_meeting" },
  { id: "exit-whisper", name: "出口低語", description: "Exit Gate 附近玩家會得到規則提示。", duration: 20, effectType: "exit_hint" }
];

export const shopItems = [
  { id: "item-flashlight", name: "備用手電筒", description: "降低關燈干擾影響。", price: 120, effectType: "resist_darkness", available: true },
  { id: "item-badge", name: "臨時門禁卡", description: "解除一次鎖門。", price: 180, effectType: "unlock_once", available: true },
  { id: "item-coffee", name: "黑咖啡", description: "下一局任務速度小幅提升。", price: 90, effectType: "task_boost", available: true }
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
