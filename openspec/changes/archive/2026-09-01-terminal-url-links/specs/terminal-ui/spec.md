## ADDED Requirements

### Requirement: Open URLs in the OS Handler

The system SHALL detect `http://` and `https://` URLs in terminal output and open them in the operating system's default handler when the user activates them with the configured gesture (Ctrl/Cmd+click by default). The system SHALL open only `http`/`https` URLs, rejecting any other scheme.

#### Scenario: Ctrl+click opens a URL

- **WHEN** a URL appears in the terminal and the user Ctrl+clicks (or Cmd+clicks) it with the default gesture setting
- **THEN** the URL opens in the operating system's default handler

#### Scenario: Plain click does not open by default

- **WHEN** the gesture setting is Ctrl+click and the user clicks a URL without holding Ctrl/Cmd
- **THEN** the URL is not opened, leaving the click free for text selection

#### Scenario: Plain-click mode

- **WHEN** the user sets the gesture to plain click and clicks a URL
- **THEN** the URL opens in the operating system's default handler

#### Scenario: Non-http scheme is refused

- **WHEN** activation is attempted for a link whose scheme is not `http` or `https`
- **THEN** the system does not open it

### Requirement: Copy a URL from the Terminal

The system SHALL provide a copy affordance when the user hovers a detected URL, letting the user copy the full URL to the clipboard in one action.

#### Scenario: Hover reveals a copy control

- **WHEN** the user hovers a detected URL in the terminal
- **THEN** a copy control showing (or acting on) that URL appears

#### Scenario: Copying places the URL on the clipboard

- **WHEN** the user activates the copy control for a hovered URL
- **THEN** the full URL is written to the system clipboard

### Requirement: URL Link Behavior Is Configurable

The system SHALL let the user configure URL link handling: enable or disable it, and choose the open gesture (Ctrl/Cmd+click or plain click). The settings SHALL persist across restarts, defaulting to enabled with a Ctrl/Cmd+click gesture.

#### Scenario: Disabling turns off link handling

- **WHEN** the user disables URL links in preferences
- **THEN** URLs are not opened on click and no copy affordance is offered

#### Scenario: Preference persists

- **WHEN** the user changes the URL link gesture and restarts the app
- **THEN** the chosen gesture is still in effect
