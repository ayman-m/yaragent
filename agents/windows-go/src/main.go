package main

import (
	"flag"
	"fmt"
)

func main() {
	enroll := flag.String("enroll-token", "", "Enrollment token")
	flag.Parse()
	fmt.Println("Minimal YARA agent stub")
	fmt.Println("Enroll token:", *enroll)
	// TODO: implement WS client, rule compile, scan runner
}
