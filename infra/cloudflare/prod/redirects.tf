resource "cloudflare_ruleset" "www_to_apex" {
  zone_id     = var.zone_id
  name        = "www to apex"
  description = "Redirect www.isometric.fi to isometric.fi"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules = [
    {
      description = "Redirect www.isometric.fi to apex"
      expression  = "(http.host eq \"www.isometric.fi\")"
      action      = "redirect"
      enabled     = true
      action_parameters = {
        from_value = {
          status_code           = 301
          preserve_query_string = true
          target_url = {
            expression = "concat(\"https://isometric.fi\", http.request.uri.path)"
          }
        }
      }
    },
  ]
}
