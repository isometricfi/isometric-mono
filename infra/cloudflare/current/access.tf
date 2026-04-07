resource "cloudflare_zero_trust_access_application" "current_app" {
  account_id                 = var.account_id
  allowed_idps               = ["a668400f-9bf9-4d30-8cae-037f7e7bed43"]
  app_launcher_visible       = true
  auto_redirect_to_identity  = false
  domain                     = "isometric.fi"
  enable_binding_cookie      = false
  http_only_cookie_attribute = false
  name                       = "isometric-prod"
  options_preflight_bypass   = false
  session_duration           = "730h"
  type                       = "self_hosted"

  destinations = [{
    type = "public"
    uri  = "isometric.fi"
  }]

  policies = [{
    id         = "dbdd89e4-52a4-4dae-b14d-7b5fc2aa519f"
    precedence = 1
  }]

  lifecycle {
    prevent_destroy = true
  }
}
