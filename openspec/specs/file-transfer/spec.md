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

### Requirement: SFTP Browser Presentation and Sorting

The SFTP file panel SHALL display each entry's modified date and let the user
sort the listing and resize the panel for readability.

#### Scenario: Modified date is shown
- **WHEN** the SFTP panel lists a directory
- **THEN** each file/folder row shows its modified date/time (from the entry's
  `mtime`), formatted compactly, with the full timestamp available on hover

#### Scenario: Sort by a column
- **WHEN** the user clicks the Name, Size, or Modified column header
- **THEN** the listing is sorted by that key, and clicking the same header again
  reverses the direction (ascending/descending), with the active key and
  direction indicated in the header

#### Scenario: Folders-first grouping
- **WHEN** the "folders first" grouping is enabled (the default)
- **THEN** directories are grouped ahead of files regardless of the active sort
  key; disabling it sorts folders and files together by the active key

#### Scenario: Resize the panel to read long names
- **WHEN** the user drags the panel's resize handle
- **THEN** the panel widens or narrows within its min/max bounds so long
  filenames become readable, and the chosen width is retained while the app
  stays open

