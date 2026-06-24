# File Transfer

## Purpose

Transfer files to and from remote hosts over SFTP, and paste clipboard images directly to
remote servers from the terminal. Backed by the SFTP manager and image-paste service in
`src/main/`.

## Requirements

### Requirement: SFTP File Operations

The system SHALL browse remote directories and upload and download files over SFTP using
an existing SSH connection.

#### Scenario: Upload a file

- **WHEN** a user uploads a local file to a remote path
- **THEN** the file is transferred over SFTP and appears at the remote path

#### Scenario: Download a file

- **WHEN** a user downloads a remote file
- **THEN** the file is written to the chosen local path

### Requirement: Clipboard Image Paste to Remote

The system SHALL detect an image on the clipboard and, on a paste action, upload it to the
remote server via SFTP and reference its remote path, gated by a user preference.

#### Scenario: Paste an image to the server

- **WHEN** the clipboard holds an image and the user triggers image paste (Ctrl+Shift+I or
  context menu "Paste Image to Server")
- **THEN** the image is uploaded over SFTP and its remote path is inserted at the prompt

#### Scenario: Feature disabled

- **WHEN** the image-paste preference is disabled
- **THEN** an image paste falls back to normal clipboard paste behavior

#### Scenario: Cleanup on quit

- **WHEN** the app is quitting
- **THEN** temporary image files created for paste are cleaned up
