import {Construct} from 'constructs';
import {Credentials, DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion, StorageType, SubnetGroup} from 'aws-cdk-lib/aws-rds';
import {InstanceClass, InstanceSize, InstanceType, PrivateSubnet, SecurityGroup, Vpc} from 'aws-cdk-lib/aws-ec2';
import {RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';
import {Secret} from 'aws-cdk-lib/aws-secretsmanager';
import {StringParameter} from "aws-cdk-lib/aws-ssm";

interface RdsStackProps extends StackProps {
    privateSubnets: PrivateSubnet[];
    securityGroup: SecurityGroup;
    vpc: Vpc;
}

export class RdsStack extends Stack {
    constructor(scope: Construct, id: string, props: RdsStackProps) {
        super(scope, id, props);

        // Create a database secret
        const databaseSecret = new Secret(this, 'DatabaseSecret', {
            secretName: `SstPocCdk-DatabaseSecret`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({
                    username: 'sstpoc'
                }),
                generateStringKey: 'password',
                passwordLength: 32,
                excludeCharacters: ' %+~`@{}[]()|/_"', // Exclude problematic characters
            },
        });

        // Create a subnet group
        const subnetGroup = new SubnetGroup(this, 'RdsSubnetGroup', {
            description: `SstPocCdk-RdsSubnetGroup`,
            subnetGroupName: `SstPocCdk-RdsSubnetGroup`,
            vpc: props.vpc,
            vpcSubnets: {
                subnets: props.privateSubnets,
            }
        });

        // Create a Postgres RDS instance
        const instance = new DatabaseInstance(this, 'RdsInstance', {
            engine: DatabaseInstanceEngine.postgres({
                version: PostgresEngineVersion.VER_14_7,
            }),
            credentials: Credentials.fromSecret(databaseSecret),
            instanceIdentifier: `SstPocCdk-Database`,
            instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO), // Free tier instance type
            vpc: props.vpc,
            removalPolicy: RemovalPolicy.DESTROY, //TODO Remove this in production
            securityGroups: [props.securityGroup],
            subnetGroup: subnetGroup,
            storageType: StorageType.GP3,
            allocatedStorage: 20,
            //TODO Add Monitoring and Autoscaling for production?
            //TODO Can snapshots be auto taken when deleting instances?
            //TODO Are regular snapshot backups automatic or need to be added?
        });

        // Export the database details to SSM
        new StringParameter(this, 'RdsIdentifierParameter', {
            parameterName: `SstPocCdk-RdsIdentifier`,
            stringValue: instance.instanceIdentifier,
        });
        new StringParameter(this, 'RdsEndpointParameter', {
            parameterName: `SstPocCdk-RdsEndpoint`,
            stringValue: instance.dbInstanceEndpointAddress,
        });
        new StringParameter(this, 'RdsPortParameter', {
            parameterName: `SstPocCdk-RdsPort`,
            stringValue: instance.dbInstanceEndpointPort,
        });
    }
}