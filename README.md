# 規則公司 Rule Company

《規則公司》是一款多人連線、規則推理、辦公室恐怖生存派對網頁遊戲。玩家分成員工與老闆：員工完成任務、推理私人規則並活到下班；老闆使用干擾技能拖慢工作、製造混亂並淘汰員工。

目前專案已實作可遊玩的第一版核心循環，並包含管理後台、商店、Render 部署設定與 PostgreSQL schema。

## 專案結構

```text
client/   React + Vite + TypeScript + Canvas + Socket.IO Client
server/   Node.js + Express + Socket.IO + Prisma + JWT + bcrypt
shared/   前後端共用 TypeScript 型別
render.yaml Render Blueprint
```

## 本機啟動

PowerShell 若封鎖 `npm.ps1`，請使用 `npm.cmd`。

```powershell
npm.cmd install
npm.cmd run dev
```

前端：http://localhost:5173
後端：http://localhost:3001

production 單一服務測試：

```powershell
npm.cmd run build
$env:NODE_ENV="production"
$env:PORT="3012"
npm.cmd run start
```

打開：http://localhost:3012

## 環境變數

後端 `server/.env`：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/rule_company?schema=public"
JWT_SECRET="replace-with-a-long-random-secret"
CLIENT_URL="http://localhost:5173"
SERVER_PORT=3001
NODE_ENV=development
ADMIN_EMAILS="admin@example.com"
```

`ADMIN_EMAILS` 用逗號分隔。production 只有這些 email 註冊或登入後能使用管理後台。

前端 `client/.env`：

```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

若沒有 `DATABASE_URL`，server 會使用記憶體帳號與房間狀態，方便本機測試。正式讓所有人使用時必須使用 PostgreSQL。

## 已完成核心功能

- JWT 註冊、登入、目前使用者 API
- 房間建立、加入、準備、開局
- Socket.IO 即時多人同步
- 每局隨機 1 名老闆，其餘為員工
- 員工職業與私人規則分配
- Canvas 2D 辦公室地圖、WASD / 方向鍵移動、區域偵測
- 員工任務、任務計時、分數與工作進度
- 階段流程：preparation、work、meeting、event、final_work、escape、ended
- 靈性事件觸發與倒數
- 老闆干擾技能、能量、冷卻、疑心值
- 遊戲聊天、即時紀錄
- 規則猜測：猜中淘汰目標，猜錯扣心
- 商店商品與人物形象上架顯示
- 商店購買、金幣扣款、庫存紀錄
- 管理後台新增、修改、刪除內容
- 後台支援規則、員工能力、老闆技能、人物形象、商店商品
- 商店商品與人物形象可上架 / 下架
- production server 可直接提供前端 build，Render 可用單一網址部署

## 管理後台

登入管理員帳號後，在遊戲頁面下方可看到「管理後台」。

可管理集合：

- 規則 `rules`
- 能力 / 員工技能 `employeeRoles`
- 老闆技能 `sabotages`
- 人物形象 `characterSkins`
- 商店商品 `shopItems`

後台使用 JSON 編輯，儲存後會立即影響 server 記憶體內容；有 PostgreSQL 時也會寫入資料庫。

## Prisma

```powershell
npm.cmd run prisma:generate --workspace server
npm.cmd run prisma:migrate --workspace server
npm.cmd run seed --workspace server
```

Render build 使用：

```powershell
npm.cmd run render:build
```

這會 build 前後端，並執行 `prisma db push` 與 seed。

## Render 部署

專案已提供 `render.yaml`，可用 Render Blueprint 建立：

- 新的 Web Service：`rule-company`
- 新的 PostgreSQL Database：`rule-company-db`
- 自動產生 `JWT_SECRET`
- 自動綁定 `DATABASE_URL`
- `NODE_ENV=production`

部署後 Render 會產生類似以下的正式網址：

```text
https://rule-company.onrender.com
```

實際網址必須等 Render 建立成功後才會出現。

## 目前限制

這是可遊玩的第一版，不是最終商業完成版。若要更接近完整正式版，下一輪應補：

- 會議投票與指控流程
- 更完整的小遊戲任務
- 好友、邀請、排行榜細節
- 多房間持久化與斷線重連恢復
- 更多角色外觀資源與音效
- 管理後台改成表單式編輯，不只 JSON 編輯
