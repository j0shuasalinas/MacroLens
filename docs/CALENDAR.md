# Nutrition calendar

Calendar replaces Journal in the primary navigation. Searchable history remains reachable
from Calendar → Search meals. Home also links to the calendar.

Each month displays daily logged calories, indicators for saved meals and today's outline.
Selecting a date loads saved meals, calories and protein/carbs/fat totals for that date.
Meal cards link to the existing editor. Log a meal pre-fills the selected date. On phone-sized
screens, a date tap scrolls toward the day details; Back to month returns to the month view.
Previous/next month and Today controls support browsing.

Monthly counters show days with at least one saved meal, total meal count, and average calories
across logged days only. Logging does not imply the day's diet is complete. Dates without
entries have a dash; a saved zero-calorie meal still counts as a logged day. Calendar dates
are local calendar strings, not UTC timestamp conversions. Current targets are not presented
as historical targets because the app does not store goal snapshots.

## Data and performance

`GET /calendar?year=2026&month=10` is authenticated, with validated month 1–12 and year 1–9998.
It calls `nutrition_calendar(month_start)` using the verified user's bearer token. Migration
003 creates this stable SQL function with invoker privileges and RLS, and filters meals by
`auth.uid()`. It returns every date in the month, totals all items in each meal, and counts
meals once, independently of the number of food items. Leap years and month lengths come
from PostgreSQL. The existing user/date index supports its range filter.

Aggregation happens in SQL, so monthly totals aren't truncated by the REST 1,000-row default
or the journal's latest-500 limit. Only one aggregated month is fetched at a time; selecting
a date fetches its meals via the existing day-filtered endpoint. Monthly results and day
meals use TanStack Query caching; existing save/edit/delete invalidations refresh them.
The day list shows at most the latest 500 meals and displays a note when more exist; its
calendar summary still includes every meal. No new frontend libraries are needed.

Apply all migrations in order, including `003_nutrition_calendar.sql`, before updating a remote
API/client. The isolated local database has already received it via `supabase migration up --local`.
