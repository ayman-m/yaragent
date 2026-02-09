# Builder image for Windows Go agent (use during CI)
FROM golang:1.20-windowsservercore-ltsc2022 AS build
WORKDIR /src
COPY ./src ./
RUN go build -o C:\agent\yara-agent.exe ./

# Note: Windows containers are only for build environments; agent is intended to run as native EXE on hosts.
