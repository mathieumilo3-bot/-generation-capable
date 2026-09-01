# Night Shift verification checkpoint

This file exists only as a CI verification checkpoint for the durable Night Shift hardening currently on `main`.

The verified path is:

`mission input → durable SQLite run → objective planning → GoalEngine execution → validation → bounded recovery → terminal state`

The Night Shift UI keeps the deadline in local wall-clock time and converts it to an absolute timestamp only when submitting the run.
