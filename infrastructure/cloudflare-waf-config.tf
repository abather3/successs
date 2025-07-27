# Cloudflare WAF Configuration with Security Rules
# This configuration sets up comprehensive WAF protection including SQLi, XSS, RCE, and bot protection

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Configure the Cloudflare Provider
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token"
  type        = string
  sensitive   = true
}

variable "zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "escashop.com"
}

variable "staging_domain" {
  description = "Staging domain name"
  type        = string
  default     = "staging.escashop.com"
}

# Enable Cloudflare WAF with Managed Rules
resource "cloudflare_ruleset" "waf_managed_rules" {
  zone_id     = var.zone_id
  name        = "WAF Managed Rules"
  description = "Managed WAF rules for comprehensive security"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  # Execute Cloudflare Managed Ruleset
  rules {
    description = "Execute Cloudflare Managed Ruleset"
    expression  = "true"
    action      = "execute"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee"
      matched_data {
        public_key = "YOUR_PUBLIC_KEY_HERE"
      }
    }
  }

  # Execute OWASP Core Rule Set
  rules {
    description = "Execute OWASP Core Rule Set"
    expression  = "true"
    action      = "execute"
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f"
      # Override specific rules in staging
      overrides {
        dynamic "rules" {
          for_each = var.staging_overrides
          content {
            id     = rules.value.id
            action = rules.value.action
          }
        }
      }
    }
  }
}

# Custom WAF Rules for Common Injection Attacks
resource "cloudflare_ruleset" "waf_custom_rules" {
  zone_id     = var.zone_id
  name        = "Custom WAF Security Rules"
  description = "Custom rules for SQLi, XSS, RCE, and bot protection"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # SQL Injection Protection
  rules {
    description = "Block SQL Injection Attempts"
    expression  = "(cf.waf.score.sqli lt 20) or (http.request.uri.query contains \"union select\") or (http.request.uri.query contains \"drop table\") or (http.request.body.raw contains \"1=1\") or (http.request.body.raw contains \"1' or '1'='1\")"
    action      = "block"
    enabled     = true
  }

  # XSS Protection
  rules {
    description = "Block XSS Attempts"
    expression  = "(cf.waf.score.xss lt 20) or (http.request.uri.query contains \"<script\") or (http.request.uri.query contains \"javascript:\") or (http.request.body.raw contains \"<script\") or (http.request.body.raw contains \"onerror=\")"
    action      = "block"
    enabled     = true
  }

  # Remote Code Execution Protection
  rules {
    description = "Block RCE Attempts"
    expression  = "(cf.waf.score.rce lt 20) or (http.request.uri.query contains \"cmd=\") or (http.request.uri.query contains \"exec(\") or (http.request.body.raw contains \"system(\") or (http.request.body.raw contains \"shell_exec(\")"
    action      = "block"
    enabled     = true
  }

  # Bot Protection - Challenge suspicious bots
  rules {
    description = "Challenge Low-Score Bots"
    expression  = "(cf.bot_management.score lt 10) and not (cf.bot_management.verified_bot)"
    action      = "managed_challenge"
    enabled     = true
  }

  # Block known malicious IPs and User Agents
  rules {
    description = "Block Malicious User Agents"
    expression  = "(http.user_agent contains \"sqlmap\") or (http.user_agent contains \"nikto\") or (http.user_agent contains \"nmap\") or (http.user_agent contains \"dirbuster\") or (http.user_agent contains \"masscan\")"
    action      = "block"
    enabled     = true
  }

  # Geo/IP Blocking for high-risk countries (customize as needed)
  rules {
    description = "Block High-Risk Countries"
    expression  = "(ip.geoip.country in {\"CN\" \"RU\" \"KP\"}) and (cf.waf.score lt 40)"
    action      = "block"
    enabled     = var.enable_geo_blocking
  }

  # Rate limiting for login attempts
  rules {
    description = "Rate Limit Login Attempts"
    expression  = "(http.request.uri.path contains \"/login\") or (http.request.uri.path contains \"/admin\")"
    action      = "block"
    enabled     = true
    ratelimit {
      characteristics = ["ip.src"]
      period          = 60
      requests_per_period = 10
      mitigation_timeout  = 600
    }
  }

  # Directory Traversal Protection
  rules {
    description = "Block Directory Traversal"
    expression  = "(http.request.uri.path contains \"../\") or (http.request.uri.path contains \"..\\\") or (http.request.uri.query contains \"../\") or (http.request.body.raw contains \"../\")"
    action      = "block"
    enabled     = true
  }

  # Leaked Credentials Detection
  rules {
    description = "Challenge Leaked Credentials"
    expression  = "(cf.waf.credential_check.username_and_password_leaked) and (http.request.uri.path contains \"/login\")"
    action      = "managed_challenge"
    enabled     = true
  }

  # Block requests with low attack score from specific paths
  rules {
    description = "Block Low Attack Score on Sensitive Paths"
    expression  = "(cf.waf.score lt 25) and (http.request.uri.path in {\"/admin\" \"/api\" \"/payment\" \"/checkout\"})"
    action      = "block"
    enabled     = true
  }
}

# Staging Environment Rules (Less Restrictive)
resource "cloudflare_ruleset" "waf_staging_rules" {
  count       = var.enable_staging_rules ? 1 : 0
  zone_id     = var.zone_id
  name        = "Staging WAF Rules"
  description = "Less restrictive rules for staging environment"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # Log-only rules for staging
  rules {
    description = "Log SQL Injection Attempts (Staging)"
    expression  = "(http.host eq \"${var.staging_domain}\") and ((cf.waf.score.sqli lt 20) or (http.request.uri.query contains \"union select\"))"
    action      = "log"
    enabled     = true
  }

  rules {
    description = "Log XSS Attempts (Staging)"
    expression  = "(http.host eq \"${var.staging_domain}\") and ((cf.waf.score.xss lt 20) or (http.request.uri.query contains \"<script\"))"
    action      = "log"
    enabled     = true
  }

  # Challenge instead of block for staging
  rules {
    description = "Challenge Low Attack Score (Staging)"
    expression  = "(http.host eq \"${var.staging_domain}\") and (cf.waf.score lt 15)"
    action      = "managed_challenge"
    enabled     = true
  }
}

# Variables for configuration
variable "enable_geo_blocking" {
  description = "Enable geographic blocking for high-risk countries"
  type        = bool
  default     = false
}

variable "enable_staging_rules" {
  description = "Enable staging-specific rules"
  type        = bool
  default     = true
}

variable "staging_overrides" {
  description = "OWASP rule overrides for staging"
  type = list(object({
    id     = string
    action = string
  }))
  default = []
}

# Security Level Configuration
resource "cloudflare_zone_settings_override" "security_settings" {
  zone_id = var.zone_id
  settings {
    security_level = "medium"
    browser_check  = "on"
    challenge_ttl  = 1800
  }
}

# Bot Management Configuration
resource "cloudflare_bot_management" "bot_config" {
  zone_id                = var.zone_id
  enable_js              = true
  fight_mode             = true
  using_latest_model     = true
  optimize_wordpress     = false
  sbfm_definitely_automated = "block"
  sbfm_static_resource_protection = false
  sbfm_verified_bots     = "allow"
}

# Output important information
output "waf_managed_rules_id" {
  value = cloudflare_ruleset.waf_managed_rules.id
}

output "waf_custom_rules_id" {
  value = cloudflare_ruleset.waf_custom_rules.id
}

output "staging_rules_id" {
  value = var.enable_staging_rules ? cloudflare_ruleset.waf_staging_rules[0].id : null
}
