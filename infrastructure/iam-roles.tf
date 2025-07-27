# IAM Roles for Least-Privilege Access
# This Terraform configuration creates IAM roles with minimal permissions

# Application Service Role
resource "aws_iam_role" "escashop_app_role" {
  name = "escashop-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "EscaShop Application Role"
    Environment = var.environment
    Purpose     = "Application service role"
  }
}

# Secrets Manager Access Policy
resource "aws_iam_policy" "secrets_manager_policy" {
  name        = "escashop-secrets-policy"
  description = "Policy for accessing EscaShop secrets in AWS Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${var.aws_account_id}:secret:escashop/*"
        ]
      }
    ]
  })
}

# KMS Key Access Policy (for encrypted secrets)
resource "aws_iam_policy" "kms_policy" {
  name        = "escashop-kms-policy"
  description = "Policy for accessing KMS keys for secret encryption"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = [
          aws_kms_key.secrets_key.arn
        ]
      }
    ]
  })
}

# CloudWatch Logs Policy
resource "aws_iam_policy" "cloudwatch_logs_policy" {
  name        = "escashop-cloudwatch-policy"
  description = "Policy for writing to CloudWatch logs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/escashop/*"
        ]
      }
    ]
  })
}

# Attach policies to the application role
resource "aws_iam_role_policy_attachment" "secrets_manager_attachment" {
  role       = aws_iam_role.escashop_app_role.name
  policy_arn = aws_iam_policy.secrets_manager_policy.arn
}

resource "aws_iam_role_policy_attachment" "kms_attachment" {
  role       = aws_iam_role.escashop_app_role.name
  policy_arn = aws_iam_policy.kms_policy.arn
}

resource "aws_iam_role_policy_attachment" "cloudwatch_logs_attachment" {
  role       = aws_iam_role.escashop_app_role.name
  policy_arn = aws_iam_policy.cloudwatch_logs_policy.arn
}

# Instance Profile for EC2 instances
resource "aws_iam_instance_profile" "escashop_profile" {
  name = "escashop-instance-profile"
  role = aws_iam_role.escashop_app_role.name
}

# KMS Key for Secrets Encryption
resource "aws_kms_key" "secrets_key" {
  description             = "KMS key for EscaShop secrets encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow use of the key"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.escashop_app_role.arn
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "EscaShop Secrets Key"
    Environment = var.environment
    Purpose     = "Secrets encryption"
  }
}

# KMS Key Alias
resource "aws_kms_alias" "secrets_key_alias" {
  name          = "alias/escashop-secrets"
  target_key_id = aws_kms_key.secrets_key.key_id
}

# Vault Authentication Role (for HashiCorp Vault)
resource "aws_iam_role" "vault_auth_role" {
  name = "escashop-vault-auth-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "EscaShop Vault Auth Role"
    Environment = var.environment
    Purpose     = "Vault authentication"
  }
}

# Vault Authentication Policy
resource "aws_iam_policy" "vault_auth_policy" {
  name        = "escashop-vault-auth-policy"
  description = "Policy for Vault AWS authentication"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "iam:GetInstanceProfile",
          "iam:GetRole",
          "sts:GetCallerIdentity"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach Vault auth policy
resource "aws_iam_role_policy_attachment" "vault_auth_attachment" {
  role       = aws_iam_role.vault_auth_role.name
  policy_arn = aws_iam_policy.vault_auth_policy.arn
}

# Database Access Role (for RDS)
resource "aws_iam_role" "database_role" {
  name = "escashop-database-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "EscaShop Database Role"
    Environment = var.environment
    Purpose     = "Database access"
  }
}

# Database Monitoring Policy
resource "aws_iam_policy" "database_monitoring_policy" {
  name        = "escashop-database-monitoring-policy"
  description = "Policy for RDS monitoring"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBClusters",
          "rds:DescribeDBSnapshots",
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach database monitoring policy
resource "aws_iam_role_policy_attachment" "database_monitoring_attachment" {
  role       = aws_iam_role.database_role.name
  policy_arn = aws_iam_policy.database_monitoring_policy.arn
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# Outputs
output "app_role_arn" {
  description = "ARN of the application role"
  value       = aws_iam_role.escashop_app_role.arn
}

output "vault_auth_role_arn" {
  description = "ARN of the Vault authentication role"
  value       = aws_iam_role.vault_auth_role.arn
}

output "secrets_key_arn" {
  description = "ARN of the KMS key for secrets encryption"
  value       = aws_kms_key.secrets_key.arn
}

output "secrets_key_alias" {
  description = "Alias of the KMS key for secrets encryption"
  value       = aws_kms_alias.secrets_key_alias.name
}
