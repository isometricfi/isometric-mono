resource "cloudflare_d1_database" "current_app" {
  account_id = var.account_id
  name       = "volumetric_d1_db"

  read_replication = {
    mode = "disabled"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_route" "current_apex" {
  zone_id = var.zone_id
  pattern = "isometric.fi/*"
  script  = var.current_worker_script_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_route" "current_www" {
  zone_id = var.zone_id
  pattern = "www.isometric.fi/*"
  script  = var.current_worker_script_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "current_apex" {
  zone_id = var.zone_id
  name    = "isometric.fi"
  type    = "AAAA"
  content = "100::"
  proxied = true
  ttl     = 1

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "current_www" {
  zone_id = var.zone_id
  name    = "www.isometric.fi"
  type    = "AAAA"
  content = "100::"
  proxied = true
  ttl     = 1

  lifecycle {
    prevent_destroy = true
  }
}
