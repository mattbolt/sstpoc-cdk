#!/bin/bash

# Check if the AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "aws is not installed. Please install it before running this script."
    exit 1
fi

# Check if the jq utility is installed
if ! command -v jq &> /dev/null; then
    echo "jq is not installed. Please install it before running this script."
    exit 1
fi

# Query the EC2 instances with the specified "Name" tag
instance_info=$(aws ec2 describe-instances \
  --profile "sstpoc" \
  --filters "Name=tag:Name,Values=SstPocCdk-Bastion" "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[InstanceId, Placement.AvailabilityZone, PublicIpAddress]' \
  --output text)

# Check if an instance is found
if [ -z "$instance_info" ]; then
  echo "No running EC2 instance found with Name tag: SstPocCdk-Bastion" >&2
  exit 1
fi

# Query the RDS instances with the specified Identifier
rds_info=$(aws rds describe-db-instances \
  --profile "sstpoc" \
  --filters "Name=db-instance-id,Values=SstPocCdk-Database" \
  --query 'DBInstances[*].[DBInstanceIdentifier, Endpoint.Address]' \
  --output text)

# Check if an instance is found
if [ -z "$rds_info" ]; then
  echo "No running RDS instance found with Identifier: SstPocCdk-Database" >&2
  exit 1
fi

# Retrieve the instance ID and availability zone
instance_id=$(echo "$instance_info" | awk '{print $1}')
rds_endpoint=$(echo "$rds_info" | awk '{print $2}')

rds_username=$(aws secretsmanager get-secret-value --secret-id "SstPocCdk-DatabaseSecret" --profile "sstpoc" --output text --query 'SecretString' | jq -r '.username')
rds_password=$(aws secretsmanager get-secret-value --secret-id "SstPocCdk-DatabaseSecret" --profile "sstpoc" --output text --query 'SecretString' | jq -r '.password')

echo "Opening a tunnel to the RDS instance. Use the following login details to connect to the database:"
echo "Host: localhost:5432"
printf "Username:\e[33m %s\e[0m\n" "$rds_username"
printf "Password:\e[33m %s\e[0m\n" "$rds_password"

# Open a tunnel to the RDS instance
aws ssm start-session --target "$instance_id" --profile "sstpoc" --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters "{\"host\":[\"$rds_endpoint\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"5432\"]}"
