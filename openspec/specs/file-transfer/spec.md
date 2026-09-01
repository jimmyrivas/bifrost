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

### Requirement: SFTP Opens at the Shell's Working Directory

The SFTP panel SHALL open at the connected shell's current remote working
directory when it is known, and provide a control to re-sync to it.

#### Scenario: Panel opens where the shell is
- **WHEN** the SFTP panel is opened for an SSH tab whose shell cwd is known
- **THEN** it lists that directory (not the SSH home), falling back to the home
  directory when the cwd is unknown

#### Scenario: Re-sync to the shell directory
- **WHEN** the user activates the "sync to shell directory" control
- **THEN** the panel navigates to the shell's current working directory

### Requirement: Tree and Breadcrumb Navigation

The SFTP browser SHALL let the user navigate anywhere in the remote filesystem
via a breadcrumb and an expandable directory tree, including the root and parents.

#### Scenario: Breadcrumb navigation
- **WHEN** the user clicks a segment of the current-path breadcrumb
- **THEN** the panel navigates to that ancestor directory

#### Scenario: Reach any directory
- **WHEN** the user expands directories in the tree or types an absolute path
- **THEN** the panel can reach any directory including `/` and sibling trees

### Requirement: Download a Viewed Markdown File

When a remote Markdown file is shown in the Markdown viewer, the viewer SHALL
offer a direct download of that file over SFTP.

#### Scenario: Download from the viewer
- **WHEN** the user activates Download in the Markdown viewer
- **THEN** a save dialog opens and the remote file is written to the chosen local
  path over SFTP, and the download is recorded in the history

### Requirement: Download History

The app SHALL keep a persistent history of downloaded files and let the user
consult and open them later.

#### Scenario: A download is recorded
- **WHEN** a file is downloaded over SFTP
- **THEN** an entry is stored with its name, remote path, local path, size, host,
  and timestamp, and survives app restarts

#### Scenario: Reveal or open a past download
- **WHEN** the user selects a history entry's reveal or open action
- **THEN** the file is revealed in the file manager or opened, respectively

### Requirement: Multi-Select Recursive Transfer

The SFTP browser SHALL support selecting multiple remote entries (files and
directories) to download together, and uploading multiple local files and
directories, recursively.

#### Scenario: Download multiple entries including a directory
- **WHEN** the user selects several files and/or directories and chooses download
- **THEN** the panel prompts for a destination folder and transfers every
  selected entry, recreating directory structure for selected directories, and
  records the downloads in the history

#### Scenario: Upload files and a directory
- **WHEN** the user chooses to upload and selects files and/or a directory
- **THEN** every selected file is uploaded into the current remote directory and
  selected directories are uploaded recursively

