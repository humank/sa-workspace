import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class IamStack extends cdk.Stack {
  public readonly eksServiceRole: iam.Role;
  public readonly eksNodeRole: iam.Role;
  public readonly bastionRole: iam.Role;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // 創建 EKS 服務角色
    this.eksServiceRole = new iam.Role(this, 'EKSClusterRole', {
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSClusterPolicy'),
      ],
    });
    
    // 創建 EKS 節點角色
    this.eksNodeRole = new iam.Role(this, 'EKSNodeRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'), // 允許使用 SSM 連接到節點
      ],
    });
    
    // 創建 Bastion Host 角色
    this.bastionRole = new iam.Role(this, 'BastionHostRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    
    // 添加自定義政策允許 EKS 描述
    this.bastionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'eks:DescribeCluster',
          'eks:ListClusters',
        ],
        resources: ['*'],
      })
    );
    
    // 添加自定義政策允許查看 CloudWatch 日誌
    this.bastionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
          'logs:GetLogEvents',
        ],
        resources: ['*'],
      })
    );
    
    // 添加自定義政策允許在 EKS 叢集上執行 kubectl 命令
    this.bastionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'eks:AccessKubernetesApi',
        ],
        resources: ['*'],
      })
    );
    
    // 輸出角色 ARN
    new cdk.CfnOutput(this, 'EksServiceRoleArn', {
      value: this.eksServiceRole.roleArn,
      description: 'EKS Service Role ARN',
    });
    
    new cdk.CfnOutput(this, 'EksNodeRoleArn', {
      value: this.eksNodeRole.roleArn,
      description: 'EKS Node Role ARN',
    });
    
    new cdk.CfnOutput(this, 'BastionRoleArn', {
      value: this.bastionRole.roleArn,
      description: 'Bastion Host Role ARN',
    });
  }
}
