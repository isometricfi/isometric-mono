---
sidebar_position: 5
---

# 投资组合 (Portfolio)

**Portfolio** 页面是您在 Isometric 上管理所有活跃和已结算头寸、查看余额以及存取资金的中心。

## 仪表板概览

在该页面的顶部，您将看到您的财务状态：

- **Net Equity**：资产净值，您的可用余额 + 当前活跃期权的估计价值
- **Available Balance**：您可以立即用于新交易或提现的资金
- **Locked Balance**：当前被锁定作为期权卖方抵押品的资金
- **Total P/L**：您在平台上的总利润或亏损

## 管理活跃头寸

**"Active Options"（活跃期权）** 部分展示了您当前持有或卖出的所有期权：

- **Type**：您是买方 (Purchased) 还是卖方 (Written)
- **Status**：活跃 (Active) 或 等待结算 (Pending Settlement)
- **Next Settlement**：下一次自动结算预计发生的时间
- **Estimated Value**：基于当前市场价格的期权当前价值

:::info 自动刷新
由于比特币价格是动态变化的，Portfolio 页面会自动刷新以提供最新的估值和盈亏数据。
:::

## 资金管理

### 存款 (Deposit)

点击 **"Deposit"** 查看您的专属 ckBTC 地址。您可以直接从此界面将原生 BTC 转换为 ckBTC。

### 提现 (Withdraw)

1. 点击 **"Withdraw"**。
2. 选择提取的是可用余额。
3. 输入提款地址。您可以提现到 ckBTC 地址或直接提到主网原生 BTC 地址。

:::warning 锁定资金
由于抵押品在期权合约中处于锁定状态，处于活跃合约中的资金（Locked Balance）在到期结算前无法提取。
:::

## 历史记录

查看您过去的交易、结算和转账记录。

- **Settled Options**：所有已到期的历史头寸
- **Transactions**：详细的资金流入流出日志

[查看历史记录页面详情 →](/quick-start/history)

## 下一步

- **[了解结算](/architecture/settlement)** - 了解资产如何自动分配
- **[期权基础](/concepts/options-basics)** - 查看期权术语
