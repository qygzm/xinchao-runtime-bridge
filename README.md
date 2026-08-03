# 心潮 Runtime Bridge

心潮 Runtime Bridge 是一个独立、可审计的本地连接工具。它把心潮平台已经到期的定时互动交给用户自己的 AI Runtime Adapter，不属于心潮网页，也不管理用户的 AI 会话。

> 当前为 `0.1.0` 基础实现。客户端协议、SSE、Injector 和 ACK 已具备；需要心潮多人平台实现本文约定的 `/bridge/v1/*` 服务端接口后才能端到端使用。

## 它解决什么

```text
用户在网页留下互动或定时内容
  → 心潮平台耐久排队
  → 本地 Bridge 收到 delivery_id
  → Runtime Adapter 注入用户指定的 AI 会话
  → Bridge 回传 delivered
```

它不会声称能唤醒一个没有后台接口的官方关闭窗口：

- 自建前端、本地 Agent、用户控制的 app-server：可以由 Adapter 后台接收；
- 活跃的官方窗口：可在平台允许的会话边界投递；
- 已关闭且没有 Hook 的官方窗口：平台保留 `waiting_for_ai`，下次连接时补投；
- UI 是否实时显示与 Runtime 是否接受是两个独立验收项。

心潮网页只需要展示本仓库链接、安装提示、在线状态和上述能力差异，不嵌入本地注入代码。

## 安全边界

- 单次 `run` 只建立一次 SSE 连接；异常后退出码为 `2`，不会无限自动重连；
- SSE 只携带 `deliveryId`，正文通过已鉴权的一次性请求读取；
- 注入内容通过 stdin 的单行 JSON 传递，不进入命令行参数；
- Injector 使用 `shell: false`；
- Bridge 的机器 Token 会从 Injector 子进程环境中移除；
- 日志只记录 delivery ID、reason 和结果，不记录正文；
- 同一 Bridge 串行投递；一次本地投递最多尝试两次；
- Runtime Adapter 必须按 `deliveryId` 幂等，防止“已注入但 ACK 丢失”导致重复；
- Adapter 必须确认正确会话已接受消息，不能只以进程成功启动作为 ACK。

## 环境要求

- Node.js 20 或更高版本；
- 心潮平台签发的机器 Token；
- 用户自己提供的 Runtime Adapter 可执行入口。

```bash
cp .env.example .env
set -a
source .env
set +a

node src/cli.js check
node src/cli.js run
```

本工具不会自动读取 `.env`。上面的命令只是 shell 示例；生产环境请使用系统密钥管理或受保护的服务环境。

## 配置

| 环境变量 | 用途 |
| --- | --- |
| `XINCHAO_BRIDGE_BASE_URL` | 心潮平台地址；非本机必须使用 HTTPS |
| `XINCHAO_BRIDGE_MACHINE_TOKEN` | 当前机器的专用 Token，至少 24 字符 |
| `XINCHAO_BRIDGE_INJECTOR_EXECUTABLE` | `run` 所需的 Adapter 可执行程序 |
| `XINCHAO_BRIDGE_INJECTOR_ARGS_JSON` | 参数字符串数组，不解析 shell 命令 |
| `XINCHAO_BRIDGE_INJECTOR_WORKING_DIRECTORY` | 可选的绝对工作目录 |
| `XINCHAO_BRIDGE_LOG_LEVEL` | `debug`、`info`、`warn` 或 `error` |
| `XINCHAO_BRIDGE_CONNECT_TIMEOUT_MS` | 建连超时，默认 15000 |
| `XINCHAO_BRIDGE_INJECT_TIMEOUT_MS` | 单次 Injector 超时，默认 30000 |

## Injector 信封

Bridge 每次启动一次 Adapter，将一行 JSON 写入 stdin：

```json
{
  "protocol": "xinchao-runtime-wake/1",
  "deliveryId": "01J...",
  "reason": "scheduled_interaction",
  "message": "她刚才留下一次拥抱，希望你回来的时候能想起来。"
}
```

Adapter 应当：

1. 校验协议和字段；
2. 按本地配置定位唯一账号、workspace、thread/session；
3. 把 `message` 作为普通入站 user turn，而不是 system prompt；
4. 按 `deliveryId` 保证幂等；
5. Runtime 接受正确会话后返回退出码 `0`；
6. 临时失败返回非零退出码并在 stderr 写简短、无敏感信息的原因。

## 平台服务端契约

Bridge 期待以下已鉴权接口：

```text
GET  /bridge/v1/health
GET  /bridge/v1/events
GET  /bridge/v1/deliveries/:deliveryId
POST /bridge/v1/deliveries/:deliveryId/ack
```

健康检查返回：

```json
{"protocol":"xinchao-bridge-server/1","status":"ok"}
```

SSE 握手与通知：

```text
event: connected
data: {"protocol":"xinchao-bridge-stream/1"}

event: delivery
data: {"protocol":"xinchao-bridge-stream/1","deliveryId":"01J..."}
```

ACK 请求支持：

```json
{"status":"delivered"}
```

或：

```json
{"status":"retryable_failed","code":"injector_failed"}
```

服务端必须保持消息耐久、ACK 幂等，并在 Bridge 离线时继续保存待投递内容。

## 开发检查

```bash
npm test
node src/cli.js --help
```

## 参考与归属

边界设计参考了 [WenXiaoWendy/galatea-garden-wake-bridge](https://github.com/WenXiaoWendy/galatea-garden-wake-bridge) 的传输层/Runtime Adapter 分离、stdin 信封和 fail-closed 思路。本项目使用自己的协议、平台队列、投递状态与心潮语义，不复制其论坛业务。

MIT License
