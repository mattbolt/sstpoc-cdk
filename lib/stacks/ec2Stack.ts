import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Instance, InstanceClass, InstanceSize, InstanceType, AmazonLinuxImage, Vpc, SecurityGroup, UserData, PublicSubnet} from 'aws-cdk-lib/aws-ec2';
import {ManagedPolicy, Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import {StringParameter} from "aws-cdk-lib/aws-ssm";

interface Ec2StackProps extends StackProps {
    publicSubnets: PublicSubnet[];
    securityGroup: SecurityGroup;
    vpc: Vpc;
}

export class Ec2Stack extends Stack {
    constructor(scope: Construct, id: string, props: Ec2StackProps) {
        super(scope, id, props);

        // Create an IAM role for the EC2 instance
        const instanceRole = new Role(this, 'InstanceRole', {
            assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
            roleName: `SstPocCdk-BastionRole`,
        });
        // Add the SSM managed policy to the role
        instanceRole.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName(
                'AmazonSSMManagedInstanceCore'
            )
        );


        // Create the EC2 instance
        const bastionInstance = new Instance(this, 'BastionInstance', {
            instanceName: `SstPocCdk-Bastion`,
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO), // Free-tier eligible instance type
            machineImage: new AmazonLinuxImage(), // Amazon Linux 2 LTS AMI
            role: instanceRole,
            securityGroup: props.securityGroup,
            userData: UserData.forLinux(),
            vpc: props.vpc,
            vpcSubnets: {
                subnets: props.publicSubnets,
            }
        });
        bastionInstance.addUserData(`
            #!/bin/bash
            set -e
            set -x
            
            # Install EC2 Instance Connect
            yum install -y ec2-instance-connect
            systemctl enable amazon-ssm-agent
            systemctl start amazon-ssm-agent
        `)

        // Export the instance details to SSM
        new StringParameter(this, 'BastionInstanceId', {
            parameterName: `SstPocCdk-BastionInstanceId`,
            stringValue: bastionInstance.instanceId,
        });
    }
}