import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SecurityGroupStackProps {
  vpc: ec2.Vpc;
}

export class SecurityGroupStack extends cdk.Stack {
  public readonly bastionSg: ec2.SecurityGroup;
  public readonly eksSg: ec2.SecurityGroup;
  public readonly databaseSg: ec2.SecurityGroup;
  
  constructor(scope: Construct, id: string, props: SecurityGroupStackProps & cdk.StackProps) {
    super(scope, id, props);
    
    // 創建 Bastion Host 安全群組
    this.bastionSg = new ec2.SecurityGroup(this, 'BastionHostSG', {
      vpc: props.vpc,
      description: 'Security group for Bastion Host',
      allowAllOutbound: true,
    });
    
    // 允許從特定 IP 的 SSH 訪問
    this.bastionSg.addIngressRule(
      ec2.Peer.ipv4('203.0.113.0/24'),  // 假設的企業 IP 範圍，請替換為實際值
      ec2.Port.tcp(22),
      'Allow SSH access from corporate network'
    );
    
    // 創建 EKS 安全群組
    this.eksSg = new ec2.SecurityGroup(this, 'EKSSG', {
      vpc: props.vpc,
      description: 'Security group for EKS cluster',
      allowAllOutbound: true,
    });
    
    // 允許節點間的內部通訊
    this.eksSg.addIngressRule(
      this.eksSg,
      ec2.Port.allTraffic(),
      'Allow all traffic between EKS nodes'
    );
    
    // 允許從 Bastion 訪問 EKS API 端點
    this.eksSg.addIngressRule(
      this.bastionSg,
      ec2.Port.tcp(443),
      'Allow HTTPS traffic from Bastion'
    );
    
    // 創建資料庫安全群組
    this.databaseSg = new ec2.SecurityGroup(this, 'DatabaseSG', {
      vpc: props.vpc,
      description: 'Security group for Aurora database',
      allowAllOutbound: false,
    });
    
    // 允許從 EKS 節點到資料庫的訪問
    this.databaseSg.addIngressRule(
      this.eksSg,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from EKS nodes'
    );
    
    // 允許從 Bastion Host 到資料庫的訪問，用於管理
    this.databaseSg.addIngressRule(
      this.bastionSg,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from Bastion Host for management'
    );
    
    // 輸出安全群組 ID
    new cdk.CfnOutput(this, 'BastionSecurityGroupId', {
      value: this.bastionSg.securityGroupId,
      description: 'Bastion Host Security Group ID',
    });
    
    new cdk.CfnOutput(this, 'EksSecurityGroupId', {
      value: this.eksSg.securityGroupId,
      description: 'EKS Security Group ID',
    });
    
    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: this.databaseSg.securityGroupId,
      description: 'Aurora Database Security Group ID',
    });
  }
}
