variable "cloudflare_api_token" {
  description = "Cloudflare API token with read access for import and plan."
  type        = string
  sensitive   = true
}

variable "account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "zone_id" {
  description = "Cloudflare zone ID for isometric.fi."
  type        = string
}

variable "current_worker_script_name" {
  description = "Worker script currently serving the public app routes."
  type        = string
  default     = "volumetric-web-production"
}
