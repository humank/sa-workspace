import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface ConnectionStackProps {
  vpc: ec2.Vpc;
}

export class ConnectionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ConnectionStackProps & cdk.StackProps) {
    super(scope, id, props);
    
    // 為 Direct Connect 創建虛擬私有網關
    const vpnGateway = new ec2.CfnVPNGateway(this, 'VPNGateway', {
      type: 'ipsec.1',
      amazonSideAsn: 65000, // AWS 端 BGP ASN
    });
    
    // 將 VPN 網關與 VPC 關聯
    new ec2.CfnVPCGatewayAttachment(this, 'VPNGatewayAttachment', {
      vpcId: props.vpc.vpcId,
      vpnGatewayId: vpnGateway.ref,
    });
    
    // 創建客戶網關 (模擬本地數據中心路由器)
    const customerGateway1 = new ec2.CfnCustomerGateway(this, 'CustomerGateway1', {
      bgpAsn: 65001, // 客戶端 BGP ASN
      ipAddress: '203.0.113.1', // 假設的客戶端公有 IP
      type: 'ipsec.1',
      tags: [
        {
          key: 'Name',
          value: 'MyAwesomeAirline-CustomerGateway1',
        },
      ],
    });
    
    // 創建第二個客戶網關作為備援
    const customerGateway2 = new ec2.CfnCustomerGateway(this, 'CustomerGateway2', {
      bgpAsn: 65001, // 客戶端 BGP ASN
      ipAddress: '203.0.113.2', // 假設的客戶端公有 IP
      type: 'ipsec.1',
      tags: [
        {
          key: 'Name',
          value: 'MyAwesomeAirline-CustomerGateway2',
        },
      ],
    });
    
    // 創建 VPN 連接
    const vpnConnection1 = new ec2.CfnVPNConnection(this, 'VPNConnection1', {
      customerGatewayId: customerGateway1.ref,
      vpnGatewayId: vpnGateway.ref,
      type: 'ipsec.1',
      staticRoutesOnly: false, // 使用 BGP 而非靜態路由
      tags: [
        {
          key: 'Name',
          value: 'MyAwesomeAirline-VPNConnection1',
        },
      ],
    });
    
    // 創建第二個 VPN 連接作為備援
    const vpnConnection2 = new ec2.CfnVPNConnection(this, 'VPNConnection2', {
      customerGatewayId: customerGateway2.ref,
      vpnGatewayId: vpnGateway.ref,
      type: 'ipsec.1',
      staticRoutesOnly: false, // 使用 BGP 而非靜態路由
      tags: [
        {
          key: 'Name',
          value: 'MyAwesomeAirline-VPNConnection2',
        },
      ],
    });
    
    // 創建 Bastion Host
    const bastionHost = new ec2.Instance(this, 'BastionHost', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      keyName: 'myawesomeairline-key', // 注意: 需要事先在 AWS 控制台建立密鑰對
      securityGroup: new ec2.SecurityGroup(this, 'BastionSG', {
        vpc: props.vpc,
        description: 'Security Group for Bastion Host',
        allowAllOutbound: true,
      }),
    });
    
    // 允許從特定 IP 地址通過 SSH 訪問 Bastion Host
    bastionHost.connections.allowFrom(
      ec2.Peer.ipv4('203.0.113.0/24'), // 企業網絡 CIDR
      ec2.Port.tcp(22),
      'Allow SSH access from corporate network'
    );
    
    // 輸出 Bastion Host 的公有 IP 和 DNS 名稱
    new cdk.CfnOutput(this, 'BastionHostIP', {
      value: bastionHost.instancePublicIp,
      description: 'Bastion Host Public IP',
    });
    
    new cdk.CfnOutput(this, 'BastionHostDNS', {
      value: bastionHost.instancePublicDnsName,
      description: 'Bastion Host Public DNS',
    });
    
    // 輸出 VPN 連接信息
    new cdk.CfnOutput(this, 'VPNConnection1Id', {
      value: vpnConnection1.ref,
      description: 'VPN Connection 1 ID',
    });
    
    new cdk.CfnOutput(this, 'VPNConnection2Id', {
      value: vpnConnection2.ref,
      description: 'VPN Connection 2 ID',
    });
    
    // 注意: 實際的 Direct Connect 需要與 AWS 或合作夥伴建立物理連接
    // 此處僅加入註釋，實際 CDK 實現將視具體需求和連接狀態而定
    /* 
      Direct Connect 設置通常需要以下步驟:
      1. 在 AWS Direct Connect 控制台或通過合作夥伴請求物理連接
      2. 建立虛擬接口 (VIF)
      3. 配置 BGP 會話
      
      一旦物理連接就緒，可以使用類似下面的代碼:
      
      const directConnectGateway = new directconnect.CfnDirectConnectGateway(this, 'DCGateway', {
        amazonSideAsn: 64512,
        name: 'MyAwesomeAirline-DCGateway',
      });
      
      new directconnect.CfnGatewayAssociation(this, 'DCGatewayAssociation', {
        directConnectGatewayId: directConnectGateway.ref,
        virtualGatewayId: vpnGateway.ref,
      });
    */
  }
}
