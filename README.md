# MyAwesomeAirline 混合雲架構

[![AWS](https://img.shields.io/badge/AWS-CDK-orange.svg)](https://aws.amazon.com/cdk/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.x-blue.svg)](https://www.typescriptlang.org/)
[![Architecture](https://img.shields.io/badge/Architecture-Hybrid%20Cloud-green.svg)](https://aws.amazon.com/hybrid/)
[![IaC](https://img.shields.io/badge/IaC-Infrastructure%20As%20Code-lightgrey.svg)](https://aws.amazon.com/cdk/)

## 專案概述

MyAwesomeAirline 混合雲架構是一個使用 AWS CDK (Cloud Development Kit) 實現的基礎設施即代碼 (IaC) 解決方案，專為航空公司設計的混合雲環境。該架構支持將訂位系統和行李追蹤系統部署在 AWS 雲端，同時保留客戶管理系統在本地 IDC，實現高可用性和災難恢復能力。

## 架構特點

- **混合雲設計**：整合本地 IDC 和 AWS 雲端，實現資源最優配置
- **高可用性**：多可用區部署，確保關鍵業務系統持續運行
- **災難恢復**：跨區域冗餘設計，RTO/RPO 達到分鐘級別
- **安全連接**：雙線路 Direct Connect 加 Site-to-Site VPN 備援
- **容器化**：使用 Amazon EKS 實現一致的容器環境
- **基礎設施即代碼**：使用 AWS CDK 管理所有雲端資源，提供可重複、可預測的部署

## 架構圖

MyAwesomeAirline 混合雲架構包含以下主要元件：

```
本地 IDC <---> AWS 主要區域 <---> AWS 次要區域 (DR)
   |               |                  |
客戶管理系統     EKS 叢集         DR EKS 叢集
PostgreSQL      Aurora 叢集       Aurora 只讀複本
```

![架構圖可在文件中查看](./myawesome-airline-architecture.md)

## 目錄結構

```
sa-workspace/
├── README.md                              # 專案說明文檔
├── aws-adr-template.md                    # AWS 架構決策記錄模板
├── myawesome-airline-IaC.md               # 基礎設施即代碼設計文檔
├── myawesome-airline-architecture.md      # 混合雲架構設計文檔
├── myawesome-airline-cost-adr.md          # 成本優化架構決策記錄
├── myawesome-airline-security-part1.md    # 安全架構設計文檔 (第一部分)
├── myawesome-airline-security-part2.md    # 安全架構設計文檔 (第二部分)
├── myawesome-airline-cdk/                 # AWS CDK 實現代碼
│   ├── lib/                               # CDK 堆疊和構造
│   │   ├── myawesome-airline-cdk-stack.ts # 主堆疊
│   │   ├── network/                       # 網路相關構造
│   │   ├── security/                      # 安全相關構造
│   │   ├── compute/                       # 計算相關構造
│   │   ├── database/                      # 資料庫相關構造
│   │   └── dr/                            # 災難恢復相關構造
│   ├── bin/                               # CDK 應用程式入口點
│   └── test/                              # 單元測試
└── typescript-hello-world/                # TypeScript 示例專案
```

## 主要元件詳情

### 網路架構

- **VPC 配置**：CIDR 10.0.0.0/16，包含公有、私有和隔離子網
- **連接**：雙線路 Direct Connect (主要) 和 Site-to-Site VPN (備援)
- **子網策略**：特定工作負載使用專用子網，提高安全性

### 安全架構

- **深度防禦**：多層安全控制，包括 IAM、安全群組、網路 ACL 等
- **最小權限**：遵循最小權限原則的 IAM 角色和策略
- **加密**：靜態與傳輸中的數據加密

### 計算架構

- **容器管理**：使用 Amazon EKS 運行訂位系統和行李追蹤系統
- **節點群組**：自動擴展的混合實例類型節點群組

### 數據架構

- **資料庫**：Amazon Aurora PostgreSQL 兼容版本，多可用區部署
- **資料複製**：從本地 PostgreSQL 到 Aurora 的資料複製
- **災難恢復**：使用 Aurora 全球資料庫實現跨區域資料複製

### 災難恢復策略

- **多區域部署**：在次要 AWS 區域部署冗餘基礎設施
- **全球資料庫**：近乎零的 RPO，分鐘級 RTO
- **故障轉移機制**：自動和手動故障轉移選項

## 開始使用

### 前置需求

- Node.js 14.x 或更高版本
- AWS CLI 已配置
- AWS CDK v2 已安裝 (`npm install -g aws-cdk`)
- AWS 帳號和適當的權限

### 安裝步驟

1. Clone 此倉庫：
   ```bash
   git clone https://github.com/humank/sa-workspace.git
   cd sa-workspace/myawesome-airline-cdk
   ```

2. 安裝依賴：
   ```bash
   npm install
   ```

3. 初次使用時，需要在目標 AWS 帳號和區域中 bootstrap CDK：
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

4. 部署堆疊：
   ```bash
   cdk deploy MyawesomeAirlineCdkStack
   ```

### 配置說明

- 編輯 `bin/myawesome-airline-cdk.ts` 以修改部署環境參數
- 檢查 `lib/` 目錄中各堆疊的建構參數

## 部署指南

### 部署順序

建議按照以下順序部署元件，確保依賴關係得到滿足：

1. 網路基礎設施
2. 安全基礎設施
3. 數據庫層
4. 計算層
5. 災難恢復元件

### 多環境部署

使用上下文變量或環境變量配置不同環境的部署參數：

```bash
cdk deploy -c environment=dev
cdk deploy -c environment=prod
```

## 最佳實踐

- **安全性**：定期更新 EKS 版本和節點 AMI
- **成本優化**：使用 Spot 實例和適當的自動擴展設置
- **監控**：設置 CloudWatch 警報監控關鍵指標
- **備份**：定期測試備份和恢復程序
- **文檔**：維護架構和操作文檔的更新

## 相關文檔

- [混合雲架構設計](./myawesome-airline-architecture.md)
- [基礎設施即代碼設計](./myawesome-airline-IaC.md)
- [成本優化 ADR](./myawesome-airline-cost-adr.md)
- [安全架構文檔 (第一部分)](./myawesome-airline-security-part1.md)
- [安全架構文檔 (第二部分)](./myawesome-airline-security-part2.md)

## 貢獻指南

歡迎提交 Pull Requests 和 Issue 來改進此專案。請確保：

1. 遵循現有的代碼風格和結構
2. 為重要變更添加單元測試
3. 更新相關文檔
4. 在提交前通過所有測試

## 許可證

[MIT](LICENSE)
