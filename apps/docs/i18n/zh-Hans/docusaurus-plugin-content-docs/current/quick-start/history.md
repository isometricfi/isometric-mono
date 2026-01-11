---
sidebar_position: 6
---

# 历史记录

**History** 页面提供您在 Isometric 平台上所有过去活动的全面审计日志，包括已结算的期权、资金转账和费用。

## 已结算期权 (Settled Options)

该部分列出了所有已到期并结清的合约：

- **Option ID**：每个期权合约的唯一 ID
- **Outcome**：
  - **ITM (In-the-Money)**：实值到期，发生了资金赔付
  - **OTM (Out-of-the-Money)**：虚值到期，期权无价值到期
- **Final Payout**：由于该期权结算而导致的账户余额变化
- **Settlement Price**：预言机在到期瞬间确定的 BTC 定向价格

## 交易历史 (Transaction History)

记录所有余额变动：

- **Deposits**：存入平台的 ckBTC 或原生 BTC
- **Withdrawals**：从平台提取的资金
- **Premium Paid/Earned**：购买期权支出的权利金或卖出期权赚取的权利金
- **Platform Fees**：支付给平台的交易手续费

## 导出数据

您可以点击 **"Export CSV"** 将您的交易历史导出，以便用于：
- 税务申报
- 外部投资组合分析
- 详细的交易日志记录

## 数据验证 (Auditing)

由于 Isometric 运行在 Internet Computer 上，您的所有历史数据都是链上透明的。您可以获取任何结算事件的交易哈希，并使用 ICP 浏览器验证预言机价格和资金流向。

---

## 下一步

- **[回到主页 →](/)**
- **[查看活跃组合 →](/quick-start/portfolio)**
