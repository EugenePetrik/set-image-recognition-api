# Minimal TFLint Configuration

config {
  call_module_type = all
}

plugin "aws" {
  enabled = true
  version = "0.27.0"
  source  = "github.com/terraform-linters/tflint-ruleset-aws"
}

plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# Enable essential rules
rule "terraform_typed_variables" {
  enabled = true
}

rule "terraform_naming_convention" {
  enabled = true
  format  = "snake_case"
}

rule "terraform_documented_variables" {
  enabled = true
}

rule "terraform_documented_outputs" {
  enabled = true
}

# Disable noisy rules
rule "aws_s3_bucket_name" {
  enabled = false
}
