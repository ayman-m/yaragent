//go:build yara
// +build yara

package main

import (
    "fmt"

    yara "github.com/hillu/go-yara/v4"
)

// compileRule uses go-yara to compile the provided rule text.
// This file is only included when building with the `-tags=yara` build tag
// and when libyara headers/libraries are available on the build host.
func compileRule(ruleText string) (string, error) {
    c, err := yara.NewCompiler()
    if err != nil {
        return "", fmt.Errorf("yara.NewCompiler error: %v", err)
    }
    if err := c.AddString(ruleText, ""); err != nil {
        return "", fmt.Errorf("compiler AddString error: %v", err)
    }
    _, err = c.GetRules()
    if err != nil {
        return "", fmt.Errorf("compiler GetRules error: %v", err)
    }
    return "yara: compiled OK", nil
}
