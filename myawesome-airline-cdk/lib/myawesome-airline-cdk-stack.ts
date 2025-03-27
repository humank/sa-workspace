import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcStack } from './network/vpc-stack';
import { ConnectionStack } from './network/connection-stack';
import { SecurityGroupStack } from './security/security-group-stack';
import { IamStack } from './security/iam-stack';
import { EksStack } from './compute/eks-stack';
import { AuroraStack } from './database/aurora-stack';
import { DrStack } from './dr/dr-stack';

export class MyawesomeAirlineCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 創建 VPC
    const vpcStack = new VpcStack(this, 'VpcStack', {
      env: props?.env,
    });

    // 創建 IAM 角色
    const iamStack = new IamStack(this, 'IamStack', {
      env: props?.env,
    });

    // 創建安全群組
    const securityGroupStack = new SecurityGroupStack(this, 'SecurityGroupStack', {
      vpc: vpcStack.vpc,
      env: props?.env,
    });

    // 創建網路連接
    const connectionStack = new ConnectionStack(this, 'ConnectionStack', {
      vpc: vpcStack.vpc,
      env: props?.env,
    });

    // 創建 EKS 叢集
    const eksStack = new EksStack(this, 'EksStack', {
      vpc: vpcStack.vpc,
      eksServiceRole: iamStack.eksServiceRole,
      eksNodeRole: iamStack.eksNodeRole,
      eksSg: securityGroupStack.eksSg,
      env: props?.env,
    });

    // 創建 Aurora 資料庫
    const auroraStack = new AuroraStack(this, 'AuroraStack', {
      vpc: vpcStack.vpc,
      databaseSg: securityGroupStack.databaseSg,
      env: props?.env,
    });

    // 創建災難恢復設施
    const drStack = new DrStack(this, 'DrStack', {
      primaryVpc: vpcStack.vpc,
      primaryClusterIdentifier: auroraStack.clusterIdentifier,
      eksServiceRole: iamStack.eksServiceRole,
      eksNodeRole: iamStack.eksNodeRole,
      env: props?.env,
    });

    // 設置依賴關係
    connectionStack.addDependency(vpcStack);
    securityGroupStack.addDependency(vpcStack);
    eksStack.addDependency(securityGroupStack);
    eksStack.addDependency(iamStack);
    auroraStack.addDependency(securityGroupStack);
    drStack.addDependency(vpcStack);
    drStack.addDependency(auroraStack);
    drStack.addDependency(iamStack);
  }
}
