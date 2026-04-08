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

resource "cloudflare_workers_route" "apex" {
  zone_id = var.zone_id
  pattern = "isometric.fi/*"
  script  = var.worker_script_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_route" "www" {
  zone_id = var.zone_id
  pattern = "www.isometric.fi/*"
  script  = var.worker_script_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "apex" {
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

resource "cloudflare_dns_record" "www" {
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
