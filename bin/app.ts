#!/usr/bin/env node
import 'source-map-support/register';
import {App} from 'aws-cdk-lib';
import {VpcStack} from "../lib/stacks/vpcStack";
import {RdsStack} from "../lib/stacks/rdsStack";
import {Ec2Stack} from "../lib/stacks/ec2Stack";

const app = new App();

// Create the VPC stack, houses the RDS and EC2 instances
const vpcStack: VpcStack = new VpcStack(app, `SstPoc-Vpc`);

// Create the RDS stack, a basic PostgreSQL instance
new RdsStack(app, `SstPoc-Rds`, {
    privateSubnets: vpcStack.privateSubnets,
    securityGroup: vpcStack.rdsSecurityGroup,
    vpc: vpcStack.vpc,
});

// Create the EC2 stack, a tiny EC2 instance for tunneling to the RDS instance
new Ec2Stack(app, `SstPoc-Ec2`, {
    publicSubnets: vpcStack.publicSubnets,
    securityGroup: vpcStack.bastionSecurityGroup,
    vpc: vpcStack.vpc,
});