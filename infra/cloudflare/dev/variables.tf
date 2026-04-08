variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "account_id" {
  type = string
}

variable "zone_id" {
  type = string
}

variable "worker_script_name" {
  type    = string
  default = "volumetric-web-dev"
}
