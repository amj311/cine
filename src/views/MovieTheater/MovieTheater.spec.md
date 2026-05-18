# MovieTheater.vue

Full-screen media playback view. Route: `/play?path=<relativePath>`.

## Responsibilities

- Load and play any media file (movies, episodes, extras)
- Manage the full lifecycle: loading → playback → end screen → next media
- Auto-fullscreen on mount (if supported)
- Wake lock (prevents screen sleep during playback)
- Watch progress tracking (periodic POST to server)
- Playback ending: end-screen with next episode/extras OR navigate back
- Episodic autoplay with configurable count
- Slide-out panels: media details (metadata/credits) and scrub editor

## Data Flow

```
Route (/play?path=...) → useMediaStore.playMedia(path)
  → store.updated++ (reactive trigger)
  → MovieTheater watch fires
    → resetState() + loadMediaData(path)
      → GET /api/theaterData?path=...
      → returns { content, parentTitle, probe }
    → MediaSession metadata update
    → nextTick → init scrubber, seek to progress, play
```

### Key data shapes

**`content` (ContentFileBase)**
```
{ type: 'movie'|'episodeFile'|'extra',
  relativePath: string, name: string, year?: string,
  seasonNumber?: number, episodeNumber?: number,
  watchProgress?: { time, duration, percentage } }
```

**`parentTitle` (CinemaItem)**
```
{ cinemaType: 'movie'|'series', name: string,
  metadata: EitherMetadata, poster?: string,
  extras: Array<Extra>, seasons?: Array<Season> }
```

**`probe` (ProbeGlossary)**
```
{ subtitles: Array<{index, format, name}>,
  audio: Array<{index, format, name}>,
  chapters: Array<{title, start_s, end_s}>,
  duration_s: number }
```

## State Machine

```
IDLE → LOADING → PLAYING → ENDED → END_SCREEN | NAV_BACK | NEXT

States managed via reactive flags:
- hasEnded: false → true on media end
- showEndScreen: false → true near end (based on percentage thresholds)
- hasLoaded: false → true on loadeddata event
- userLeftEndScreen: true when user clicks back into video
```

## Key Behaviors

### Media Loading

`watch(() => useMediaStore().updated)` triggers everything:
1. `resetState()` — pauses video, clears all state
2. `loadMediaData(path)` — fetches theaterData from API
3. Sets MediaSession metadata
4. `nextTick` → init scrubber, seek to saved progress, play

### Progress Tracking

- Polls `playerRef.value?.getProgress()` every 1s
- POSTs to server every 30s of playback time
- Tracks end-card percentages per content type:
  - Movie: ending cards at 95%, end screen at 100%
  - Episode: ending cards at 97%, end screen at 98.5%

### End Behavior

`onEnd()`:
1. Posts final progress (100%)
2. Releases wake lock
3. Branches:
   - Autoplay enabled → `playNext()` (triggers store update)
   - End screen has content → show end screen
   - Otherwise → navigate back

### Navigation

- **Back**: `carefulBackNav()` — uses `router.back()` if possible, else navigates to browse view
- **Title click**: navigates to parent title's browse page
- **Fullscreen exit on TV**: auto-navigates back

### Audio

- `probe.audio[0]` is the default track
- `probe.audio[1+]` shown as secondary audio options on end screen
- `selectSubtitle()` persisted to localStorage (`deviceSubtitlePreference`)

## Sub-components

| Component | Purpose |
|-----------|---------|
| `VideoPlayer` | Core `<video>` wrapper, handles controls, subtitles, chapters, MSE streaming |
| `MediaCard` | Poster/thumbnail display for episode cards |
| `ExtrasList` | Horizontal scroll of extras (trailers, featurettes, etc.) |
| `ScrubSettings` | Edit/view scrubs (skip/mute segments) for current media |
| `MediaTimer` | Countdown/stopwatch overlay |
| `PersonModal` | Cast/crew detail modal |
| `NavTrigger` | Slide-out panel trigger for details/scrub panels |
| `DropdownTrigger` | Autoplay count dropdown |
| `Scroll` | Custom scroll container |

## VideoPlayer Integration

VideoPlayer is the core player component. MovieTheater binds:

| Prop | Source |
|------|--------|
| `relativePath` | `contentFile.relativePath` |
| `loadingSplash` | Auto-generated thumbnail or metadata still |
| `title` | Computed from content type (movie/episode/extra) |
| `autoplay` | Always `true` |
| `subtitles` | `probe.subtitles` |
| `audio` | `probe.audio` |
| `chapters` | `probe.chapters` |
| `onPlay` | Wake lock request, clear ended state |
| `onPause` | Release wake lock |
| `onEnd` | Final progress, end-screen logic |
| `onNextTrack` | Play next episode |
| `onPrevTrack` | Play previous episode |

Exposed refs used:
- `videoRef` — for currentTime, duration, play/pause
- `getProgress()` — returns WatchProgress
- `setTime()` — seek
- `setAudio()` — switch audio track

## End Screen

Appears near the end of playback (based on percentage thresholds). Shows:
- Title + replay + audio track options
- Next episode card (with metadata, poster, progress, autoplay countdown)
- Parent title extras (for last episode of series)
- Current season extras (for last episode of season)
- Next extra (if current content is an extra)
- Mini player in corner (picture-in-picture style)

**Thresholds** (from `contentFile.type`):
- Movie: ending cards at 95%, end screen at 100%
- Episode: ending cards at 97%, end screen at 98.5%
- If < 15s remaining, skip end screen entirely

## Menu Panels

Two slide-out panels from the right side:

| Panel | Trigger | Content |
|-------|---------|---------|
| Details | Info button | Media metadata, cast, crew, credits |
| Scrub | Mop button | Scrub profile editor (skip/mute segments) |

## Autoplay

- Only available for series (episodes)
- Configurable count via dropdown (0-∞)
- Count decrements on each autoplay
- Toast notification on each autoplay trigger
- Shows auto-play countdown on end screen

## Files in this directory

```
MovieTheater/
├── MovieTheater.vue      # Main view component
├── MovieTheater.spec.md  # This spec
├── scrubber.store.ts     # Pinia store for scrub profiles
└── ScrubSettings.vue     # Scrub editor panel
```
