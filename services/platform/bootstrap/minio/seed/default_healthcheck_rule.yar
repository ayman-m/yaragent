rule default_healthcheck_rule {
  meta:
    description = "Default seeded YARA rule for MinIO bootstrap validation"
    author = "yaragent"
  strings:
    $a = "yaragent"
  condition:
    $a
}
