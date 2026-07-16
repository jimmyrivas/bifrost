## ADDED Requirements

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
