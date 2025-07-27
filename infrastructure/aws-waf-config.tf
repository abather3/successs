# AWS WAF Configuration
# This configuration provides comprehensive protection against common threats such as SQLi, XSS, RCE, and more

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  description = "Environment name (staging/production)"
  type        = string
  default     = "production"
}

variable "application_name" {
  description = "Application name"
  type        = string
  default     = "escashop"
}

variable "enable_geo_blocking" {
  description = "Enable geographic blocking"
  type        = bool
  default     = false
}

variable "blocked_countries" {
  description = "List of countries to block (ISO 3166-1 alpha-2 codes)"
  type        = list(string)
  default     = []
}

variable "rate_limit_requests" {
  description = "Rate limit for requests per 5 minutes"
  type        = number
  default     = 2000
}

# Main WAF Web ACL
resource "aws_wafv2_web_acl" "main" {
  name        = "${var.application_name}-waf-${var.environment}"
  description = "WAF for ${var.application_name} - ${var.environment}"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Managed Rules - SQL Injection
  rule {
    name     = "AWS-AWSManagedRulesSQLiRuleSet"
    priority = 1

    override_action {
      dynamic "count" {
        for_each = var.environment == "staging" ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = var.environment == "production" ? [1] : []
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.application_name}-sqli-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Common Rule Set
  rule {
    name     = "AWS-AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      dynamic "count" {
        for_each = var.environment == "staging" ? [1] : []
        content {}
      }
      dynamic "none" {
        for_each = var.environment == "production" ? [1] : []
        content {}
      }
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
        
        # Exclude rules that might cause false positives in staging
        dynamic "rule_action_override" {
          for_each = var.environment == "staging" ? [
            {
              name   = "GenericRFI_QUERYARGUMENTS"
              action = "count"
            },
            {
              name   = "GenericRFI_BODY"
              action = "count"
            }
          ] : []
          content {
            name = rule_action_override.value.name
            action_to_use {
              count {}
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.application_name}-common-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWS-AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.application_name}-known-bad-inputs-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Bot Control
  rule {
    name     = "AWS-AWSManagedRulesBotControlRuleSet"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesBotControlRuleSet"
        vendor_name = "AWS"
        
        managed_rule_group_configs {
          aws_managed_rules_bot_control_rule_set {
            inspection_level = "COMMON"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.application_name}-bot-control-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # Rate Limiting Rule
  rule {
    name     = "RateLimitRule"
    priority = 5

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit_requests
        aggregate_key_type = "IP"
        
        scope_down_statement {
          not_statement {
            statement {
              byte_match_statement {
                field_to_match {
                  single_header {
                    name = "user-agent"
                  }
                }
                positional_constraint = "CONTAINS"
                search_string         = "health-check"
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.application_name}-rate-limit-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # Geographic Blocking (if enabled)
  dynamic "rule" {
    for_each = var.enable_geo_blocking && length(var.blocked_countries) > 0 ? [1] : []
    content {
      name     = "GeoBlockingRule"
      priority = 6

      action {
        block {}
      }

      statement {
        geo_match_statement {
          country_codes = var.blocked_countries
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.application_name}-geo-blocking-${var.environment}"
        sampled_requests_enabled   = true
      }
    }
  }

  # Custom Bad Bots Rule
  rule {
    name     = "BlockBadBots"
    priority = 7

    action {
      block {}
    }

    statement {
      or_statement {
        statement {
          byte_match_statement {
            field_to_match {
              single_header {
                name = "user-agent"
              }
            }
            positional_constraint = "CONTAINS"
            search_string         = "sqlmap"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
        statement {
          byte_match_statement {
            field_to_match {
              single_header {
                name = "user-agent"
              }
            }
            positional_constraint = "CONTAINS"
            search_string         = "nikto"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
        statement {
          byte_match_statement {
            field_to_match {
              single_header {
                name = "user-agent"
              }
            }
            positional_constraint = "CONTAINS"
            search_string         = "nmap"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
        statement {
          byte_match_statement {
            field_to_match {
              single_header {
                name = "user-agent"
              }
            }
            positional_constraint = "CONTAINS"
            search_string         = "dirbuster"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.application_name}-bad-bots-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  # Admin Path Protection
  rule {
    name     = "AdminPathProtection"
    priority = 8

    action {
      block {}
    }

    statement {
      and_statement {
        statement {
          byte_match_statement {
            field_to_match {
              uri_path {}
            }
            positional_constraint = "STARTS_WITH"
            search_string         = "/admin"
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
        statement {
          not_statement {
            statement {
              ip_set_reference_statement {
                arn = aws_wafv2_ip_set.admin_allowlist.arn
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.application_name}-admin-protection-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.application_name}-waf-${var.environment}"
    sampled_requests_enabled   = true
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
    ManagedBy   = "Terraform"
  }
}

# IP Set for Admin Allowlist
resource "aws_wafv2_ip_set" "admin_allowlist" {
  name               = "${var.application_name}-admin-allowlist-${var.environment}"
  description        = "IP addresses allowed to access admin paths"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  
  addresses = var.admin_allowed_ips

  tags = {
    Environment = var.environment
    Application = var.application_name
    ManagedBy   = "Terraform"
  }
}

variable "admin_allowed_ips" {
  description = "List of IP addresses/ranges allowed to access admin paths"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Default to allow all - should be restricted
}

# CloudWatch Log Group for WAF
resource "aws_cloudwatch_log_group" "waf_log_group" {
  name              = "/aws/wafv2/${var.application_name}-${var.environment}"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Application = var.application_name
    ManagedBy   = "Terraform"
  }
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "waf_logging" {
  resource_arn            = aws_wafv2_web_acl.main.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf_log_group.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }

  logging_filter {
    default_behavior = "KEEP"

    filter {
      behavior    = "DROP"
      condition {
        action_condition {
          action = "ALLOW"
        }
      }
      requirement = "MEETS_ALL"
    }
  }
}

# Custom rule to block requests with known bad bots
resource "aws_wafv2_rule_group" "block_bad_bots" {
  name        = "${var.application_name}-block-bad-bots-${var.environment}"
  description = "Block known bad bots by User-Agent"
  scope       = "REGIONAL"
  capacity    = 50

  rule {
    name     = "BlockBadBots"
    priority = 1

    action {
      block {}
    }

    statement {
      byte_match_statement {
        field_to_match {
          single_header {
            name = "user-agent"
          }
        }

        positional_constraint = "CONTAINS"
        search_string         = "badbot"
        text_transformation {
          priority = 0
          type     = "NONE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.application_name}-block-bad-bots-${var.environment}"
      sampled_requests_enabled   = true
    }
  }

  tags = {
    Environment = var.environment
    Application = var.application_name
    ManagedBy   = "Terraform"
  }
}

# Outputs
output "waf_web_acl_id" {
  description = "The ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.id
}

output "waf_web_acl_arn" {
  description = "The ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}

output "waf_log_group_name" {
  description = "The name of the CloudWatch log group for WAF"
  value       = aws_cloudwatch_log_group.waf_log_group.name
}

output "admin_ip_set_arn" {
  description = "The ARN of the admin IP allowlist"
  value       = aws_wafv2_ip_set.admin_allowlist.arn
}
