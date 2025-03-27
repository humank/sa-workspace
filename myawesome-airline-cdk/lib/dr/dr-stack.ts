import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DrStackProps {
  primaryVpc: ec2.Vpc;
  primaryClusterIdentifier: string;
  eksServiceRole: iam.Role;
  eksNodeRole: iam.Role;
}

export class DrStack extends cdk.Stack {
  public readonly drVpc: ec2.Vpc;
  
  constructor(scope: Construct, id: string, props: DrStackProps & cdk.StackProps) {
    super(scope, id, props);
    
    // 創建 DR 區域中的 VPC (與主要 VPC 類似的配置)
    this.drVpc = new ec2.Vpc(this, 'DrVpc', {
      cidr: '10.1.0.0/16', // 不同的 CIDR 範圍，避免 IP 衝突
      maxAzs: 3,
      natGateways: 3,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        }
      ],
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
      },
    });
    
    // 創建安全群組 for DR EKS 叢集
    const drEksSg = new ec2.SecurityGroup(this, 'DrEKSSG', {
      vpc: this.drVpc,
      description: 'Security group for DR EKS cluster',
      allowAllOutbound: true,
    });
    
    drEksSg.addIngressRule(
      drEksSg,
      ec2.Port.allTraffic(),
      'Allow all traffic between EKS nodes'
    );
    
    // 創建安全群組 for DR Aurora 資料庫
    const drDatabaseSg = new ec2.SecurityGroup(this, 'DrDatabaseSG', {
      vpc: this.drVpc,
      description: 'Security group for DR Aurora database',
      allowAllOutbound: false,
    });
    
    drDatabaseSg.addIngressRule(
      drEksSg,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL access from EKS nodes'
    );
    
    // 創建 DR EKS 叢集
    const drCluster = new eks.CfnCluster(this, 'DrEKSCluster', {
      name: 'MyAwesomeAirline-DR-EKS',
      version: '1.24',
      roleArn: props.eksServiceRole.roleArn,
      resourcesVpcConfig: {
        subnetIds: this.drVpc.privateSubnets.map(subnet => subnet.subnetId),
        securityGroupIds: [drEksSg.securityGroupId],
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
            keyArn: new kms.Key(this, 'DrEKSSecretKey', {
              enableKeyRotation: true,
              description: 'KMS key for DR EKS secrets encryption',
            }).keyArn,
          },
        },
      ],
    });
    
    // 創建 DR EKS 節點群組
    const drNodeGroup = new eks.CfnNodegroup(this, 'DrNodeGroup', {
      clusterName: drCluster.ref,
      nodegroupName: 'dr-nodes',
      nodeRole: props.eksNodeRole.roleArn,
      subnets: this.drVpc.privateSubnets.map(subnet => subnet.subnetId),
      instanceTypes: ['m5.large', 'm5a.large'],
      scalingConfig: {
        minSize: 2,
        maxSize: 6,
        desiredSize: 2,
      },
      diskSize: 50,
      capacityType: 'ON_DEMAND',
      labels: {
        'role': 'dr',
        'environment': 'dr',
      },
      tags: {
        'Name': 'MyAwesomeAirline-DR-EKS-NodeGroup',
        'Environment': 'DR',
      },
    });
    
    // 創建 DR 區域中的 Aurora 只讀副本
    // 注意：在實際實施中，應該使用 Aurora 全球資料庫，但 CDK 目前不直接支持，
    // 因此這裡提供的是使用 CfnDBCluster (低級 CloudFormation 構造) 的範例
    const drAuroraCluster = new rds.CfnDBCluster(this, 'DrAuroraCluster', {
      engine: 'aurora-postgresql',
      engineVersion: '13.7',
      dbClusterIdentifier: 'myawesomeairline-aurora-dr',
      dbSubnetGroupName: new rds.CfnDBSubnetGroup(this, 'DrAuroraSubnetGroup', {
        dbSubnetGroupDescription: 'DB Subnet Group for DR Aurora cluster',
        subnetIds: this.drVpc.isolatedSubnets.map(subnet => subnet.subnetId),
      }).ref,
      vpcSecurityGroupIds: [drDatabaseSg.securityGroupId],
      storageEncrypted: true,
      copyTagsToSnapshot: true,
      deletionProtection: true,
      enableIamDatabaseAuthentication: true,
      sourceRegion: props.env?.region, // 主要區域
      // 在實際部署時，應將此替換為主要 Aurora 全球資料庫的 ARN
      // 此處僅為示例，實際中可能需要在 CDK 外部手動設置 Aurora 全球資料庫
      // globalClusterIdentifier: '...',
    });
    
    // 為 DR Aurora 叢集添加實例
    const drAuroraInstance1 = new rds.CfnDBInstance(this, 'DrAuroraInstance1', {
      engine: 'aurora-postgresql',
      dbInstanceClass: 'db.r5.large',
      dbClusterIdentifier: drAuroraCluster.ref,
      dbInstanceIdentifier: 'myawesomeairline-aurora-dr-instance1',
    });
    
    const drAuroraInstance2 = new rds.CfnDBInstance(this, 'DrAuroraInstance2', {
      engine: 'aurora-postgresql',
      dbInstanceClass: 'db.r5.large',
      dbClusterIdentifier: drAuroraCluster.ref,
      dbInstanceIdentifier: 'myawesomeairline-aurora-dr-instance2',
    });
    
    // 創建 VPC 對等連接 (連接主要 VPC 和 DR VPC)
    const vpcPeering = new ec2.CfnVPCPeeringConnection(this, 'VpcPeering', {
      vpcId: this.drVpc.vpcId,
      peerVpcId: props.primaryVpc.vpcId,
    });
    
    // 更新主要 VPC 的路由表，添加通往 DR VPC 的路由
    props.primaryVpc.publicSubnets.forEach((subnet, index) => {
      new ec2.CfnRoute(this, `PrimaryTodrPublicRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: this.drVpc.vpcCidrBlock,
        vpcPeeringConnectionId: vpcPeering.ref,
      });
    });
    
    props.primaryVpc.privateSubnets.forEach((subnet, index) => {
      new ec2.CfnRoute(this, `PrimaryTodrPrivateRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: this.drVpc.vpcCidrBlock,
        vpcPeeringConnectionId: vpcPeering.ref,
      });
    });
    
    props.primaryVpc.isolatedSubnets.forEach((subnet, index) => {
      new ec2.CfnRoute(this, `PrimaryTodrIsolatedRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: this.drVpc.vpcCidrBlock,
        vpcPeeringConnectionId: vpcPeering.ref,
      });
    });
    
    // 更新 DR VPC 的路由表，添加通往主要 VPC 的路由
    this.drVpc.publicSubnets.forEach((subnet, index) => {
      new ec2.CfnRoute(this, `DrToPrimaryPublicRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.primaryVpc.vpcCidrBlock,
        vpcPeeringConnectionId: vpcPeering.ref,
      });
    });
    
    this.drVpc.privateSubnets.forEach((subnet, index) => {
      new ec2.CfnRoute(this, `DrToPrimaryPrivateRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.primaryVpc.vpcCidrBlock,
        vpcPeeringConnectionId: vpcPeering.ref,
      });
    });
    
    this.drVpc.isolatedSubnets.forEach((subnet, index) => {
      new ec2.CfnRoute(this, `DrToPrimaryIsolatedRoute${index}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: props.primaryVpc.vpcCidrBlock,
        vpcPeeringConnectionId: vpcPeering.ref,
      });
    });
    
    // 輸出 DR 資源信息
    new cdk.CfnOutput(this, 'DrVpcId', {
      value: this.drVpc.vpcId,
      description: 'DR VPC ID',
    });
    
    new cdk.CfnOutput(this, 'DrClusterName', {
      value: drCluster.ref,
      description: 'DR EKS 叢集名稱',
    });
    
    new cdk.CfnOutput(this, 'DrClusterEndpoint', {
      value: drCluster.attrEndpoint,
      description: 'DR EKS 叢集 API 端點',
    });
    
    new cdk.CfnOutput(this, 'DrAuroraEndpoint', {
      value: drAuroraCluster.attrEndpointAddress,
      description: 'DR Aurora 叢集端點',
    });
    
    new cdk.CfnOutput(this, 'VpcPeeringId', {
      value: vpcPeering.ref,
      description: 'VPC 對等連接 ID',
    });
  }
}
