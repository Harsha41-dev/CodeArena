# Feature Roadmap

This project now has a stronger live-launch feature slice:

- Problem stats and richer problem sorting.
- Persisted daily challenge with admin-selected problems and rewards.
- Admin-managed curated practice sets with ordered public list pages.
- Next-problem recommendation.
- Active sample-case runs.
- Resizable workspace panels.
- Editor settings and visible autosave state.
- Submission history filters.
- Submission detail comparison, approximate runtime/memory percentile, and improved error/result panels.
- Accepted submission sharing into persisted solution posts with voting and visibility.
- Workspace solutions tab with personal accepted submissions and shared community solution posts.
- Editorial unlock behavior after a user attempts the problem, plus structured sections, hints, diagrams, and official multi-language solutions.
- Contest submit time-window enforcement.
- Contest upsolve behavior after contest end.
- Contest clarification threads and admin announcements.
- Contest leaderboard freeze support and persistent contest rating jobs.
- Study-plan pages with ordered problems, persisted progress, daily unlock metadata, and persisted badges.
- Revision queue.
- Public profile share pages with difficulty progress, persisted badges, country/rank metadata, topic strengths, follows, and rating history.
- Profile submission calendar days link to exact filtered submission history.
- Profile activity feed linked to submission details.
- Discussion markdown rendering and newest/top/unanswered sorting.
- Persisted helpful markers and accepted answers for discussion comments.
- Admin rejudge controls.
- Admin problem preview before publish.
- Admin problem catalog with public, private draft, and archived visibility states.
- Admin testcase validator before publish.
- Admin launch analytics for accepted rate and judge errors.
- Virtual contest practice with topic/company filters and persisted user sessions.
- Mock interview mode with timer, topic/company filters, and persisted user session reports.
- Moderation reports, admin audit logs, abuse analytics, database backups, monitoring alerts, and optional webhook delivery.

These are enough for a credible portfolio/demo launch when combined with the deployment hardening checklist.
They are not yet enough for a large public LeetCode-style platform.
Anonymous mock-interview and virtual-contest sessions still use browser storage because they do not have a user account to attach to.

## Next Feature Priorities

1. Bulk problem import/export and multi-step content review before publish.
2. Stronger recommendation scoring using skipped history, weak-topic history, and difficulty progression over time.
3. More precise runtime and memory percentile distributions against all accepted submissions.
4. Contest rating seasons, rated eligibility rules, and rating rollback/rejudge policy UX.
5. Dedicated company sheets with admin frequency analytics and company-specific preparation plans.
6. More complete moderation workflows, including reviewer assignment, escalation, and user sanctions.
7. External production alerts for queue latency, judge failure trends, and suspicious execution volume.
8. Email verification, password reset, session/device management, and stronger account security.
9. Payments or feature gates only if the product direction needs them.
10. Load testing, observability dashboards, and backup restore drills before broad public traffic.

## Launch Guidance

For a first public demo, keep signups controlled, use Judge0 rather than local Docker execution, avoid production seed
accounts, and verify that API, worker, Redis, Postgres, migrations, and frontend API URL are all configured separately.

For a broader public launch, add abuse protection, email verification, stronger session storage, monitoring, backups,
rate-limit persistence, and a proper moderation flow before investing heavily in social and contest features.
