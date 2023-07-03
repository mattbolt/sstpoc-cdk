import {Stack, StackProps, Tags} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {
    Vpc, IpAddresses, CfnInternetGateway, CfnVPCGatewayAttachment, CfnRoute, SecurityGroup,
    Peer, Port, PrivateSubnet, PublicSubnet
} from 'aws-cdk-lib/aws-ec2';

export class VpcStack extends Stack {
    public readonly vpc: Vpc;
    public readonly bastionSecurityGroup: SecurityGroup;
    public readonly rdsSecurityGroup: SecurityGroup;
    public readonly privateSubnets: PrivateSubnet[];
    public readonly publicSubnets: PublicSubnet[];

    constructor(scope: Construct, id: string, props: StackProps = {}) {
        super(scope, id, props);

        // Create VPC
        this.vpc = new Vpc(this, `VPC`, {
            ipAddresses: IpAddresses.cidr('172.16.0.0/16'),
            maxAzs: 0,
            natGateways: 0,
            subnetConfiguration: [],
            vpcName: `SstPocCdk-Vpc`
        });


        // Create Internet Gateway and attach it to the VPC
        const igw = new CfnInternetGateway(this, 'InternetGateway', {
            tags: [{key: 'Name', value: `SstPocCdk-InternetGateway`}]
        });
        new CfnVPCGatewayAttachment(this, 'VPCGatewayAttachment', {
            internetGatewayId: igw.ref,
            vpcId: this.vpc.vpcId,
        });


        // Create a security group for the Bastion instance
        this.bastionSecurityGroup = new SecurityGroup(this, 'BastionSecurityGroup', {
            allowAllOutbound: false, // Set as false to disable allowing all outbound traffic
            securityGroupName: `SstPocCdk-BastionSecurityGroup`,
            vpc: this.vpc,
        });

        // Create a security group for the RDS instance
        this.rdsSecurityGroup = new SecurityGroup(this, 'RdsSecurityGroup', {
            allowAllOutbound: false, // Set as false to disable allowing all outbound traffic
            description: 'Security group for RDS instance',
            securityGroupName: `SstPocCdk-RdsSecurityGroup`,
            vpc: this.vpc,
        });

        // Allow SSH access to bastion host from the internet and allow outbound traffic to RDS instance on SQL port
        this.bastionSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow SSH access from the internet');
        this.bastionSecurityGroup.addEgressRule(Peer.anyIpv4(), Port.tcp(443), 'Allow outbound traffic on HTTPS ports for SSM connections');
        this.bastionSecurityGroup.addEgressRule(Peer.anyIpv4(), Port.tcpRange(1024, 65535), 'Allow outbound traffic on ephemeral ports for SSH connections');
        // Allow inbound traffic from the bastion host on the SQL port
        this.rdsSecurityGroup.addIngressRule(Peer.securityGroupId(this.bastionSecurityGroup.securityGroupId), Port.tcp(5432), 'Allow input traffic from bastion host on SQL port');
        this.rdsSecurityGroup.addEgressRule(Peer.anyIpv4(), Port.tcpRange(1024, 65535), 'Allow outbound traffic on ephemeral ports');


        this.privateSubnets = [];
        this.publicSubnets = [];
        // Loop through the availability zones and create a public subnet and route table for each
        for (let i = 0; i < 3; i++) {
            // Create the public subnet and name it appropriately
            const publicSubnet = new PublicSubnet(this, `PublicSubnet${String.fromCharCode(65 + i)}`, {
                availabilityZone: `ap-southeast-2${String.fromCharCode(97 + i)}`,
                cidrBlock: `172.16.${i}.0/24`,
                mapPublicIpOnLaunch: true,
                vpcId: this.vpc.vpcId,
            });
            Tags.of(publicSubnet).add('Name', `SstPocCdk-PublicSubnet${String.fromCharCode(65 + i)}`);
            this.publicSubnets.push(publicSubnet);

            // Add a route to the Internet Gateway for this subnet
            new CfnRoute(this, `PublicSubnetRoute${String.fromCharCode(65 + i)}`, {
                destinationCidrBlock: '0.0.0.0/0',
                gatewayId: igw.ref,
                routeTableId: publicSubnet.routeTable.routeTableId,
            });

            // Create the private subnet and name it appropriately
            const privateSubnet = new PrivateSubnet(this, `PrivateSubnet${String.fromCharCode(65 + i)}`, {
                availabilityZone: `ap-southeast-2${String.fromCharCode(97 + i)}`,
                cidrBlock: `172.16.${i + 3}.0/24`,
                mapPublicIpOnLaunch: false,
                vpcId: this.vpc.vpcId,
            });
            Tags.of(privateSubnet).add('Name', `SstPocCdk-PrivateSubnet${String.fromCharCode(65 + i)}`);
            this.privateSubnets.push(privateSubnet);
        }
    }
}