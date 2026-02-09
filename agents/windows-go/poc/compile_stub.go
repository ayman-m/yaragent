//go:build !yara
// +build !yara

package main

import (
    "fmt"
    "strings"
)

// compileRule is a stub implementation used when libyara/go-yara is unavailable.
func compileRule(ruleText string) (string, error) {
    trimmed := strings.TrimSpace(ruleText)
    if trimmed == "" {
        return "", fmt.Errorf("empty rule")
    }
    // very small heuristic check: ensure 'rule' keyword exists
    if !strings.Contains(ruleText, "rule ") {
        return "", fmt.Errorf("no 'rule' keyword found")
    }
    return "stub: compiled OK", nil
}
