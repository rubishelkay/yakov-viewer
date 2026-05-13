# Admin Dashboard And Set Editor

## Dashboard Direction

The dashboard should be the admin home screen.

It should combine:

- simple analytics;
- popular photos;
- upload/processing state;
- unfinished work;
- storage and trash reminders.

Think of a much simpler photographer-side stock dashboard: not a business analytics suite, but a useful daily control center.

## Dashboard Blocks

Recommended blocks:

```txt
Popular photos
  most viewed/opened/downloaded/liked

Today / 7 days
  pageviews or visits

Work in progress
  draft albums
  review photos
  failed processing jobs

Recent uploads
  latest imported albums and status

Storage
  rough public/private size

Trash
  items waiting for cleanup
```

Likes can come later. First implementation can use views, fullscreen opens, and downloads as popularity signals.

## Set Editor Direction

The admin should use a left-to-right workflow.

```txt
left rail
  Dashboard
  Sets
  Albums
  Tags
  Settings
  Trash

middle pane
  ordered list of sets

right pane
  selected set composer
```

The middle set list should be simple:

```txt
order
title
status
album count
layout mode
```

The right set composer should show:

```txt
set title/status
layout mode
album membership
album order inside set
cover/featured choices
preview of the public set section
```

Later, this can become a more custom homepage composer. First version should use fixed layout modes and manual album ordering.

