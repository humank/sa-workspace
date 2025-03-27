import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AuroraStackProps {
  vpc: ec2.Vpc;
  databaseSg: ec2.SecurityGroup;
}

export class AuroraStack extends cdk.Stack {
  public readonly clusterEndpoint: string;
  public readonly clusterIdentifier: string;
  
  constructor(scope: Construct, id: string, props: AuroraStackProps & cdk.StackProps) {
    super(scope, id, props);
    
    // 創建 KMS 密鑰用於加密數據庫
    const databaseKey = new kms.Key(this, 'DatabaseKey', {
      enableKeyRotation: true,
      description: 'KMS key for Aurora database encryption',
      alias: 'alias/myawesomeairline/aurora',
    });
    
    // 創建參數組
    const parameterGroup = new rds.ParameterGroup(this, 'AuroraParamGroup', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_7,
      }),
      parameters: {
        'shared_buffers': '4096MB',
        'max_connections': '1000',
        'ssl': '1',
        'log_statement': 'ddl',
      },
      description: 'Parameter group for MyAwesomeAirline Aurora cluster',
    });
    
    // 創建子網組
    const subnetGroup = new rds.SubnetGroup(this, 'AuroraSubnetGroup', {
      description: 'Subnet group for MyAwesomeAirline Aurora cluster',
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    
    // 創建 Aurora 叢集
    const cluster = new rds.DatabaseCluster(this, 'MyAwesomeAirlineDB', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_13_7,
      }),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R5, ec2.InstanceSize.LARGE),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        vpc: props.vpc,
        securityGroups: [props.databaseSg],
        parameterGroup: parameterGroup,
      },
      instances: 3, // 1 主實例 + 2 個只讀副本
      parameterGroup: parameterGroup,
      subnetGroup: subnetGroup,
      backup: {
        retention: cdk.Duration.days(14),
        preferredWindow: '02:00-03:00',
      },
      storageEncryptionKey: databaseKey,
      storageEncrypted: true,
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: cdk.aws_logs.RetentionDays.TWO_WEEKS,
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      defaultDatabaseName: 'airlinedb',
      credentials: rds.Credentials.fromGeneratedSecret('airlineadmin', {
        secretName: 'myawesomeairline/aurora/admin',
      }),
      monitoringInterval: cdk.Duration.seconds(60),
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      copyTagsToSnapshot: true,
      iamAuthentication: true,
    });
    
    // 儲存數據庫參數供後續使用
    this.clusterEndpoint = cluster.clusterEndpoint.hostname;
    this.clusterIdentifier = cluster.clusterIdentifier;
    
    // 輸出資料庫連接資訊
    new cdk.CfnOutput(this, 'DBClusterEndpoint', {
      value: cluster.clusterEndpoint.hostname,
      description: '資料庫叢集端點',
    });
    
    new cdk.CfnOutput(this, 'DBReadEndpoint', {
      value: cluster.clusterReadEndpoint.hostname,
      description: '資料庫讀取端點',
    });
    
    new cdk.CfnOutput(this, 'DBSecret', {
      value: cluster.secret!.secretName,
      description: '資料庫密碼 Secret 名稱',
    });
    
    // 標記資源
    cdk.Tags.of(cluster).add('Project', 'MyAwesomeAirline');
    cdk.Tags.of(cluster).add('Environment', 'Production');
  }
}
