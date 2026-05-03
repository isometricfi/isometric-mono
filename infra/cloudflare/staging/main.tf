resource "cloudflare_d1_database" "app" {
  account_id = var.account_id
  name       = "volumetric_d1_prod"

  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_route" "app" {
  zone_id = var.zone_id
  pattern = "staging.isometric.fi/*"
  script  = var.worker_script_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "app" {
  zone_id = var.zone_id
  name    = "staging.isometric.fi"
  type    = "AAAA"
  content = "100::"
  proxied = true
  ttl     = 1

  lifecycle {
    prevent_destroy = true
  }
}
