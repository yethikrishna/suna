package main

import (
	"os"
	"strings"
	"testing"
)

func TestBuildPinsPatchedCaddyRelease(t *testing.T) {
	buildScript, err := os.ReadFile("build.sh")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(buildScript), `CADDY_VERSION="v2.11.4"`) {
		t.Fatal("build.sh must pin Caddy v2.11.4")
	}
}
