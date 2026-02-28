# web-nuxt Auction MVP

这个目录是 Nuxt 版本前端，当前已接入：

- 钱包连接（GemWallet / Crossmark / Xaman）
- Create Auction（开始时间 / 结束时间 / 图片）
- 上传图片和 metadata 到 Pinata（返回 `imageCid` / `metaCid`）
- 通过 XRPL `Payment + Memo(AUCTION_CREATE)` 写链上锚点
- 在 `My Bids` 页面同步显示开始时间和 metadata 信息

## 1. 前置要求

- Node.js 18+
- pnpm 8+
- Chrome/Edge 钱包扩展（推荐 GemWallet）
- Pinata JWT（需要有 pin 相关 scopes）

## 2. 安装依赖

在仓库根目录执行：

```powershell
cd scaffold-xrp
npx pnpm@8.10.0 install
```

## 3. 配置环境变量（必需）

在 `apps/web-nuxt` 下创建 `.env`（可由 `.env.example` 复制）：

```env
PINATA_JWT=your_pinata_jwt_here
VITE_DEFAULT_NETWORK=alphanet
```

> 不要把真实 JWT 提交到 Git 仓库。

## 4. 启动方式

### 方式 A：用脚本（推荐）

```powershell
cd apps/web-nuxt
.\run-web-nuxt.ps1 -PinataJwt "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2YWIzNDA5My00NzJmLTQ4NzAtOGFlZC02NTQ1NzNiYzJmMDMiLCJlbWFpbCI6ImpveXlpeWFuZzk0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJiZDU2MDBiYWRkOWNiNDljYTIwZCIsInNjb3BlZEtleVNlY3JldCI6IjUyMzU0NTE5ODQwMWU2ODlmODgxNWMzNzBmNjFjZDM1MjYzODhlYmU0ZGQ2NmFkMTdiMTA5ZWYzYzRmZTMzYjMiLCJleHAiOjE4MDM4MDM1MTR9.QGvBLiTj5_hr6_9Sw3qaSniliiAqaP6TCCJ7u3i-3dg"
```

### 方式 B：手动

```powershell
cd apps/web-nuxt
$env:PINATA_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI2YWIzNDA5My00NzJmLTQ4NzAtOGFlZC02NTQ1NzNiYzJmMDMiLCJlbWFpbCI6ImpveXlpeWFuZzk0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJiZDU2MDBiYWRkOWNiNDljYTIwZCIsInNjb3BlZEtleVNlY3JldCI6IjUyMzU0NTE5ODQwMWU2ODlmODgxNWMzNzBmNjFjZDM1MjYzODhlYmU0ZGQ2NmFkMTdiMTA5ZWYzYzRmZTMzYjMiLCJleHAiOjE4MDM4MDM1MTR9.QGvBLiTj5_hr6_9Sw3qaSniliiAqaP6TCCJ7u3i-3dg"
npx pnpm@8.10.0 dev
```

启动后打开终端打印的地址（例如 `http://127.0.0.1:3000` 或 `3001`）。

## 5. 发布流程（Create 页面）

1. 进入 `/create`
2. 连接钱包（Testnet）
3. 填写标题、起拍价、最小加价、开始/结束时间
4. 选择图片文件
5. 点击 `Publish (web3 + on-chain)`
6. 在钱包弹窗确认 `Submit Transaction`
7. 页面显示：
   - `Auction ID`
   - `Image CID`
   - `Meta CID`
   - `Anchor Tx`

## 6. 常见问题

- `NO_SCOPES_FOUND`  
  Pinata key 没有开 `pinFileToIPFS` / `pinJSONToIPFS` scope。

- `token is malformed`  
  JWT 不完整，检查 `($env:PINATA_JWT -split '\.').Count` 必须为 `3`。

- `would do nothing`  
  交易目标地址不能和发送地址相同（代码已改为固定锚点地址）。

- `Failed to fetch`  
  常见是跑错目录或端口不一致。请确认只在本目录启动并访问同一端口。

## 7. 安全建议

- JWT 仅用于服务端，不要放在前端代码里
- 如果 JWT 泄露，立即在 Pinata 控制台吊销并重建
- 如果你曾把 JWT 提交到 Git，请立刻轮换密钥并重写历史
