# ════════════════════════════════════════════════════════════════════════════
# kortix-gha-tf-apply-{dev,staging,prod,global} — the OIDC roles that
# .github/workflows/terraform-apply.yml assumes to run `terraform apply` in CI.
#
# WHY: before these existed, deploy-prod-us-east-2-shadow.yml was the only
# workflow in the repository that applied Terraform. Every other root was
# applied by hand, so merged infrastructure could sit unapplied indefinitely —
# on 2026-08-10 two merged compliance PRs (#6295, #6344) did exactly that.
#
# TRUST: the GitHub environment is part of the OIDC subject, so a workflow that
# does not declare `environment: <name>` cannot assume the matching role. This
# is the same containment the prod-use2 bootstrap role uses
# (iam-gha-prod-use2-terraform.tf). Pair each environment with a deployment
# branch restriction (dev -> main, staging -> staging, prod -> prod,
# infra-global -> main) so the subject cannot be minted from a stray branch.
#
# PERMISSIONS: PowerUserAccess plus a narrow inline IAM grant, matching the
# prod-use2 role. PowerUserAccess covers everything a root builds (VPC, ECS,
# ALB, KMS, S3, ACM, WAF, Lambda, CloudWatch, autoscaling, DynamoDB state lock)
# and excludes IAM, Organizations, and Account. The env roles get IAM write on
# their own `kortix-<env>-*` task and execution roles only.
# ════════════════════════════════════════════════════════════════════════════

locals {
  # environment name => IAM role-name prefix the root is allowed to manage.
  # environments/dev + dev-web create kortix-dev-*, kortix-dev-web-*,
  # kortix-dev-gateway-*; staging and prod follow the same shape.
  gha_tf_apply_envs = {
    dev     = "kortix-dev-"
    staging = "kortix-staging-"
    prod    = "kortix-prod-"
  }
}

resource "aws_iam_role" "gha_tf_apply" {
  for_each = local.gha_tf_apply_envs

  name = "kortix-gha-tf-apply-${each.key}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.github_actions.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:kortix-ai/suna:environment:${each.key}"
        }
      }
    }]
  })

  tags = {
    ManagedBy  = "terraform"
    Name       = "kortix-gha-tf-apply-${each.key}"
    Stack      = "security-baseline"
    Compliance = "soc2"
  }
}

# checkov:skip=CKV_AWS_274: The environment-scoped OIDC trust plus the inline IAM
# policy below constrain this role. PowerUserAccess is what a full environment
# root needs (VPC, ECS, ALB, KMS, S3, ACM, WAF, autoscaling) and it excludes IAM.
resource "aws_iam_role_policy_attachment" "gha_tf_apply_power_user" {
  for_each = local.gha_tf_apply_envs

  role       = aws_iam_role.gha_tf_apply[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

# The ecs-api module creates the task role, the execution role, and (since
# #6295) the SES sender policy on the task role. PowerUserAccess denies IAM, so
# grant exactly those actions, only on this environment's own role prefix.
resource "aws_iam_role_policy" "gha_tf_apply_iam" {
  for_each = local.gha_tf_apply_envs

  name = "tf-apply-${each.key}-iam"
  role = aws_iam_role.gha_tf_apply[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ManageOnlyThisEnvironmentTaskRoles"
        Effect = "Allow"
        Action = [
          "iam:AttachRolePolicy",
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:DeleteRolePolicy",
          "iam:DetachRolePolicy",
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:ListRolePolicies",
          "iam:PassRole",
          "iam:PutRolePolicy",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:UpdateRole",
          "iam:UpdateRoleDescription",
        ]
        Resource = [
          "arn:aws:iam::${local.account_id}:role/${each.value}*",
        ]
      },
    ]
  })
}

# ── Account-global roots: compliance-monitoring + security-baseline ──────────
#
# These two roots are not environment infrastructure. They manage the account
# security baseline itself: IAM roles that are NOT kortix-<env>-* prefixed
# (whatsapp-gateway-*, bedrock-logs), IAM groups and their memberships, the
# account password policy, CloudTrail, GuardDuty in 17 regions, the S3 account
# public-access block, WAF, and the compliance Lambdas.
#
# There is no useful resource-level scope for that: the role must be able to
# manage arbitrarily named IAM roles, including its own. So this grant is
# IAM-wide, which is admin-equivalent in the limit — a caller that can attach a
# policy to a role it controls can grant itself anything.
#
# What actually contains it:
#   1. the OIDC subject is pinned to `environment:infra-global`, and that
#      environment is restricted to the `main` deployment branch;
#   2. terraform-apply-global.yml runs only on push to main, i.e. only after a
#      reviewed PR merged;
#   3. the Deny below removes the one escalation that survives a merge review —
#      minting a long-lived human credential (IAM user, access key, console
#      password) that outlives the workflow run.
resource "aws_iam_role" "gha_tf_apply_global" {
  name = "kortix-gha-tf-apply-global"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = data.aws_iam_openid_connect_provider.github_actions.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:kortix-ai/suna:environment:infra-global"
        }
      }
    }]
  })

  tags = {
    ManagedBy  = "terraform"
    Name       = "kortix-gha-tf-apply-global"
    Stack      = "security-baseline"
    Compliance = "soc2"
  }
}

# checkov:skip=CKV_AWS_274: see the comment above — security-baseline manages the
# account IAM surface, so PowerUserAccess plus IAM write is the minimum that can
# apply it. Containment is the environment-scoped OIDC subject, the main-branch
# restriction, and the credential-minting Deny below.
resource "aws_iam_role_policy_attachment" "gha_tf_apply_global_power_user" {
  role       = aws_iam_role.gha_tf_apply_global.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

resource "aws_iam_role_policy" "gha_tf_apply_global_iam" {
  name = "tf-apply-global-iam"
  role = aws_iam_role.gha_tf_apply_global.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ManageAccountIamBaseline"
        Effect   = "Allow"
        Action   = ["iam:*"]
        Resource = "*"
      },
      {
        # Everything above is reviewable in a Terraform plan. Creating a human
        # credential is not something any root here does, and it is the one
        # escalation that keeps working after the workflow run ends.
        Sid    = "DenyLongLivedCredentialMinting"
        Effect = "Deny"
        Action = [
          "iam:CreateUser",
          "iam:DeleteUser",
          "iam:CreateAccessKey",
          "iam:UpdateAccessKey",
          "iam:CreateLoginProfile",
          "iam:UpdateLoginProfile",
          "iam:CreateServiceSpecificCredential",
          "iam:ResetServiceSpecificCredential",
          "iam:UploadSigningCertificate",
          "iam:UploadSSHPublicKey",
          "iam:DeleteVirtualMFADevice",
        ]
        Resource = "*"
      },
    ]
  })
}

output "gha_tf_apply_role_arn_dev" {
  description = "Set as the repo variable TF_APPLY_ROLE_ARN_DEV (deploy-dev.yml)."
  value       = aws_iam_role.gha_tf_apply["dev"].arn
}

output "gha_tf_apply_role_arn_staging" {
  description = "Set as the repo variable TF_APPLY_ROLE_ARN_STAGING (deploy-staging.yml)."
  value       = aws_iam_role.gha_tf_apply["staging"].arn
}

output "gha_tf_apply_role_arn_prod" {
  description = "Set as the repo variable TF_APPLY_ROLE_ARN_PROD (deploy-prod.yml)."
  value       = aws_iam_role.gha_tf_apply["prod"].arn
}

output "gha_tf_apply_role_arn_global" {
  description = "Set as the repo variable TF_APPLY_ROLE_ARN_GLOBAL (terraform-apply-global.yml)."
  value       = aws_iam_role.gha_tf_apply_global.arn
}
