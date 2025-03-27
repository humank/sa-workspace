# MyAwesomeAirline CDK 專案

這是 MyAwesomeAirline 混合雲架構的 AWS CDK 實現代碼。本專案使用 TypeScript 編寫，提供基礎設施即代碼 (IaC) 解決方案，用於部署航空公司的混合雲環境，支援將訂位系統和行李追蹤系統部署在 AWS 雲端，同時保持與本地 IDC 的連接。

## 專案概述

MyAwesomeAirline CDK 專案實現了一個完整的混合雲基礎設施，包括：

- 多可用區 VPC 網路架構
- EKS 叢集用於容器化應用程式
- Aurora PostgreSQL 資料庫叢集
- Direct Connect 和 VPN 連接
- 跨區域災難恢復 (DR) 基礎設施
- 完整的安全配置（IAM、安全群組等）

## 目錄結構

```
myawesome-airline-cdk/
├── lib/                               # 主要代碼目錄
│   ├── myawesome-airline-cdk-stack.ts # 主堆疊，組合所有元件
│   ├── network/                       # 網路元件
│   │   ├── vpc-stack.ts              # VPC、子網等配置
│   │   └── connection-stack.ts       # Direct Connect、VPN 連接
│   ├── security/                      # 安全元件
│   │   ├── security-group-stack.ts   # 安全群組配置
│   │   └── iam-stack.ts             # IAM 角色和政策
│   ├── compute/                       # 計算元件
│   │   └── eks-stack.ts             # EKS 叢集和節點群組
│   ├── database/                      # 資料庫元件
│   │   └── aurora-stack.ts          # Aurora 資料庫叢集
│   └── dr/                           # 災難恢復元件
│       └── dr-stack.ts              # DR VPC、跨區域資料庫複製等
├── bin/                               # 應用程式入口點
│   └── myawesome-airline-cdk.ts      # CDK 應用程式定義
└── test/                              # 單元測試
    └── myawesome-airline-cdk.test.ts # 主堆疊測試
```

## 建構專案

### 前置需求

- Node.js 14.x 或更高版本
- AWS CLI 已安裝並配置（`aws configure`）
- AWS CDK v2 已全局安裝：`npm install -g aws-cdk`

### 初始設定

1. 切換到專案目錄：
   ```bash
   cd myawesome-airline-cdk
   ```

2. 安裝依賴：
   ```bash
   npm install
   ```

3. 編譯 TypeScript 代碼：
   ```bash
   npm run build
   ```

4. 執行單元測試：
   ```bash
   npm run test
   ```

### CDK 部署流程

1. 首次使用前，需要在目標 AWS 帳號和區域中進行 bootstrap：
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

2. 檢視將要部署的 CloudFormation 變更：
   ```bash
   cdk diff
   ```

3. 合成 CloudFormation 模板（無需實際部署）：
   ```bash
   cdk synth
   ```

4. 部署整個堆疊：
   ```bash
   cdk deploy
   ```

   或指定特定堆疊：
   ```bash
   cdk deploy MyawesomeAirlineCdkStack
   ```

5. 部署時設定環境參數：
   ```bash
   cdk deploy -c environment=dev
   ```

## 自定義配置

主要配置項在各個堆疊檔案中設定。以下是一些常見的修改點：

### VPC 配置

在 `lib/network/vpc-stack.ts` 中修改 VPC CIDR、子網配置等：

```typescript
// 範例：修改 VPC CIDR
this.vpc = new ec2.Vpc(this, 'MainVpc', {
  cidr: '10.100.0.0/16', // 修改 CIDR 範圍
  maxAzs: 3,
  // 其他配置...
});
```

### EKS 配置

在 `lib/compute/eks-stack.ts` 中修改 EKS 版本、節點類型等：

```typescript
// 範例：修改 EKS 版本和節點型號
const cluster = new eks.Cluster(this, 'MyCluster', {
  version: eks.KubernetesVersion.V1_25, // 升級 Kubernetes 版本
  // 其他配置...
});

cluster.addNodegroupCapacity('standard-nodes', {
  instanceTypes: [new ec2.InstanceType('m6i.large')], // 變更執行個體類型
  // 其他配置...
});
```

### Aurora 配置

在 `lib/database/aurora-stack.ts` 中修改資料庫引擎版本、執行個體類型等。

## 更新與維護

### 更新 CDK 版本

1. 更新全局 CDK：
   ```bash
   npm update -g aws-cdk
   ```

2. 更新專案依賴：
   ```bash
   npm update
   ```

### 新增或修改資源

1. 在現有 Stack 中新增資源：
   - 編輯相應的堆疊文件
   - 建構並部署：`npm run build && cdk deploy`

2. 新增全新的 Stack：
   - 在 `lib/` 目錄下創建新的堆疊文件
   - 在 `lib/myawesome-airline-cdk-stack.ts` 中引入並實例化新堆疊
   - 設定相依關係
   - 建構並部署

3. 刪除資源：
   - 從代碼中移除資源定義
   - 使用 `cdk deploy` 更新堆疊（會刪除資源）
   - 或使用 `cdk destroy` 刪除整個堆疊

### 最佳實踐

- 使用版本控制系統追蹤所有變更
- 在開發環境中測試變更後再應用到生產環境
- 定期更新 CDK 版本和依賴，以獲取最新功能和安全性更新
- 使用 CDK 差異比較 (`cdk diff`) 在部署前預覽變更
- 為重要資源啟用刪除保護
- 定期檢查和更新 IAM 權限，遵循最小權限原則

## 常見指令

* `npm run build`   - 編譯 TypeScript 代碼
* `npm run watch`   - 監視變更並自動編譯
* `npm run test`    - 執行 Jest 單元測試
* `cdk deploy`      - 部署堆疊到預設 AWS 帳號/區域
* `cdk diff`        - 比較已部署堆疊與當前狀態
* `cdk synth`       - 產生 CloudFormation 模板
* `cdk destroy`     - 刪除已部署的堆疊
* `cdk list`        - 列出應用中定義的所有堆疊

## 參考資源

- [AWS CDK 文件](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [AWS CDK TypeScript API 參考](https://docs.aws.amazon.com/cdk/api/latest/typescript/api/index.html)
- [完整架構文檔](../myawesome-airline-architecture.md)
- [基礎設施即代碼設計](../myawesome-airline-IaC.md)
