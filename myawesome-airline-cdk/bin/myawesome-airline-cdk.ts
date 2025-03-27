#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MyawesomeAirlineCdkStack } from '../lib/myawesome-airline-cdk-stack';

const app = new cdk.App();

// 定義環境變數
const primaryEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.PRIMARY_REGION || 'ap-northeast-1', // 東京區域作為主要區域
};

const drEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.DR_REGION || 'ap-southeast-1', // 新加坡區域作為災難恢復區域
};

// 部署主堆疊到主要區域
new MyawesomeAirlineCdkStack(app, 'MyawesomeAirlinePrimary', {
  env: primaryEnv,
  description: 'MyAwesome Airline 主要區域基礎設施 (uksb-1q9p6d4tj)',
  tags: {
    'Project': 'MyAwesomeAirline',
    'Environment': 'Production',
    'Region': 'Primary',
  }
});

// 部署災難恢復堆疊到 DR 區域
new MyawesomeAirlineCdkStack(app, 'MyawesomeAirlineDr', {
  env: drEnv,
  description: 'MyAwesome Airline 災難恢復區域基礎設施 (uksb-1q9p6d4tj)',
  tags: {
    'Project': 'MyAwesomeAirline',
    'Environment': 'Production',
    'Region': 'DR',
  }
});
