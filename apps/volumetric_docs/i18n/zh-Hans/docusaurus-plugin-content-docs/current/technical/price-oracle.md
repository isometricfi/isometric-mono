---
sidebar_position: 3
title: 价格预言机
---

# 价格预言机

期权结算时，协议使用单一的 BTC/USD 价格。该价格来自互联网计算机的**汇率容器（Exchange Rate Canister, XRC）**，一个作为系统服务维护的链上价格数据源。

## 价格如何确定

XRC 从多家主要交易所拉取 BTC/USD 数据，返回中位数。汇总过程在链上完成，由多个节点达成共识，因此每个节点同意的价格就是协议用于结算的价格。

几个特性使其难以被操纵：

- **多个数据源。** 操纵结果需要同时在多个交易所推动价格。
- **中位数，而非均值。** 单一异常交易所无法显著改变结果。
- **链上 + 共识。** 每个节点都验证结果。没有管理员可以在事后覆盖它。

链上查验：[汇率容器](https://dashboard.internetcomputer.org/canister/uf6dk-hyaaa-aaaaq-qaaaq-cai)。源代码：[dfinity/exchange-rate-canister](https://github.com/dfinity/exchange-rate-canister)。
