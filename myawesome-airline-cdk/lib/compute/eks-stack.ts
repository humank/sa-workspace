import * as eks from 'aws-cdk-lib/aws-eks';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface EksStackProps {
  vpc: ec2.Vpc;
  eksServiceRole: iam.Role;
  eksNodeRole: iam.Role;
  eksSg: ec2.SecurityGroup;
}

export class EksStack extends cdk.Stack {
  public readonly clusterName: string;
  public readonly clusterEndpoint: string;
  
  constructor(scope: Construct, id: string, props: EksStackProps & cdk.StackProps) {
    super(scope, id, props);
    
    // 創建 EKS 叢集 (使用低級別的 CfnCluster)
    const cluster = new eks.CfnCluster(this, 'MyAwesomeAirlineEKSCluster', {
      name: 'MyAwesomeAirlineEKS',
      version: '1.24',
      roleArn: props.eksServiceRole.roleArn,
      resourcesVpcConfig: {
        subnetIds: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
        securityGroupIds: [props.eksSg.securityGroupId],
        endpointPrivateAccess: true,
        endpointPublicAccess: false,
      },
      logging: {
        clusterLogging: {
          enabledTypes: [
            {
              type: 'api',
            },
            {
              type: 'audit',
            },
            {
              type: 'authenticator',
            },
          ],
        },
      },
      encryptionConfig: [
        {
          resources: ['secrets'],
          provider: {
            keyArn: new cdk.aws_kms.Key(this, 'EKSSecretKey', {
              enableKeyRotation: true,
              description: 'KMS key for EKS secrets encryption',
            }).keyArn,
          },
        },
      ],
    });
    
    this.clusterName = cluster.ref;
    this.clusterEndpoint = cluster.attrEndpoint;
    
    // 創建 OIDC Provider 用於服務帳戶
    const oidcProvider = new iam.OpenIdConnectProvider(this, 'OIDCProvider', {
      url: cluster.attrOpenIdConnectIssuerUrl,
      clientIds: ['sts.amazonaws.com'],
    });
    
    // 創建主要節點群組
    const mainNodeGroup = new eks.CfnNodegroup(this, 'MainNodeGroup', {
      clusterName: cluster.ref,
      nodegroupName: 'main-nodes',
      nodeRole: props.eksNodeRole.roleArn,
      subnets: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
      instanceTypes: ['m5.large', 'm5a.large'],
      scalingConfig: {
        minSize: 2,
        maxSize: 10,
        desiredSize: 3,
      },
      diskSize: 50,
      capacityType: 'ON_DEMAND',
      labels: {
        'role': 'general',
        'environment': 'production',
      },
      tags: {
        'Name': 'MyAwesomeAirline-EKS-MainNodeGroup',
        'Environment': 'Production',
      },
    });
    
    // 創建高效能節點群組
    const highPerfNodeGroup = new eks.CfnNodegroup(this, 'HighPerfNodeGroup', {
      clusterName: cluster.ref,
      nodegroupName: 'high-perf-nodes',
      nodeRole: props.eksNodeRole.roleArn,
      subnets: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
      instanceTypes: ['c5.xlarge', 'c5a.xlarge'],
      scalingConfig: {
        minSize: 1,
        maxSize: 5,
        desiredSize: 2,
      },
      diskSize: 50,
      capacityType: 'ON_DEMAND',
      labels: {
        'role': 'high-performance',
        'environment': 'production',
      },
      tags: {
        'Name': 'MyAwesomeAirline-EKS-HighPerfNodeGroup',
        'Environment': 'Production',
      },
    });
    
    // 為 AWS Load Balancer Controller 創建 IAM 角色
    const lbControllerRole = this.createServiceAccountRole(
      'AwsLoadBalancerControllerRole',
      'kube-system',
      'aws-load-balancer-controller',
      oidcProvider,
      [
        'iam:CreateServiceLinkedRole',
        'ec2:DescribeAccountAttributes',
        'ec2:DescribeAddresses',
        'ec2:DescribeInternetGateways',
        'ec2:DescribeVpcs',
        'ec2:DescribeSubnets',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeInstances',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DescribeTags',
        'elasticloadbalancing:DescribeLoadBalancers',
        'elasticloadbalancing:DescribeLoadBalancerAttributes',
        'elasticloadbalancing:DescribeListeners',
        'elasticloadbalancing:DescribeTargetGroups',
        'elasticloadbalancing:DescribeTargetGroupAttributes',
        'elasticloadbalancing:DescribeTargetHealth',
        'elasticloadbalancing:DescribeTags',
      ],
      [
        'ec2:AuthorizeSecurityGroupIngress',
        'ec2:RevokeSecurityGroupIngress',
        'ec2:CreateSecurityGroup',
        'ec2:CreateTags',
        'ec2:DeleteTags',
        'ec2:CreateNetworkInterface',
        'ec2:DeleteNetworkInterface',
        'ec2:ModifyNetworkInterfaceAttribute',
        'elasticloadbalancing:CreateListener',
        'elasticloadbalancing:DeleteListener',
        'elasticloadbalancing:CreateRule',
        'elasticloadbalancing:DeleteRule',
        'elasticloadbalancing:AddTags',
        'elasticloadbalancing:RemoveTags',
        'elasticloadbalancing:ModifyLoadBalancerAttributes',
        'elasticloadbalancing:SetIpAddressType',
        'elasticloadbalancing:SetSecurityGroups',
        'elasticloadbalancing:SetSubnets',
        'elasticloadbalancing:DeleteLoadBalancer',
        'elasticloadbalancing:ModifyTargetGroup',
        'elasticloadbalancing:ModifyTargetGroupAttributes',
        'elasticloadbalancing:DeleteTargetGroup',
        'elasticloadbalancing:RegisterTargets',
        'elasticloadbalancing:DeregisterTargets',
      ]
    );
    
    // 為 CloudWatch Agent 創建 IAM 角色
    const cloudWatchAgentRole = this.createServiceAccountRole(
      'CloudWatchAgentRole',
      'amazon-cloudwatch',
      'cloudwatch-agent',
      oidcProvider,
      ['cloudwatch:PutMetricData'],
      []
    );
    
    // 輸出 EKS 叢集信息
    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.ref,
      description: 'EKS 叢集名稱',
    });
    
    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: cluster.attrEndpoint,
      description: 'EKS 叢集 API 端點',
    });
    
    new cdk.CfnOutput(this, 'MainNodeGroupId', {
      value: mainNodeGroup.ref,
      description: '主要節點群組 ID',
    });
    
    new cdk.CfnOutput(this, 'HighPerfNodeGroupId', {
      value: highPerfNodeGroup.ref,
      description: '高性能節點群組 ID',
    });
    
    new cdk.CfnOutput(this, 'OIDCProviderArn', {
      value: oidcProvider.openIdConnectProviderArn,
      description: 'OIDC Provider ARN',
    });
    
    new cdk.CfnOutput(this, 'OIDCProviderUrl', {
      value: cluster.attrOpenIdConnectIssuerUrl,
      description: 'OIDC Provider URL',
    });
  }
  
  // 為服務帳戶創建 IAM 角色 (IRSA)
  private createServiceAccountRole(
    id: string,
    namespace: string,
    serviceAccountName: string,
    provider: iam.OpenIdConnectProvider,
    readOnlyActions: string[],
    writeActions: string[]
  ): iam.Role {
    // 使用 CfnJson 延遲解析到部署時間
    const issuerSubCondition = new cdk.CfnJson(this, `${id}IssuerSubCondition`, {
      value: {
        [`${provider.openIdConnectProviderIssuer}:sub`]: `system:serviceaccount:${namespace}:${serviceAccountName}`
      }
    });

    const issuerAudCondition = new cdk.CfnJson(this, `${id}IssuerAudCondition`, {
      value: {
        [`${provider.openIdConnectProviderIssuer}:aud`]: 'sts.amazonaws.com'
      }
    });

    const role = new iam.Role(this, id, {
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: issuerSubCondition,
        'ForAnyValue:StringEquals': issuerAudCondition
      }),
    });
    
    if (readOnlyActions.length > 0) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: readOnlyActions,
        resources: ['*'],
      }));
    }
    
    if (writeActions.length > 0) {
      role.addToPolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: writeActions,
        resources: ['*'],
      }));
    }
    
    return role;
  }
}
