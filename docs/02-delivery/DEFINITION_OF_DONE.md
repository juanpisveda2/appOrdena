# Definition of Done

Implementation for an approved slice is done only when all applicable conditions below are met.

## Mandatory Checklist
- [ ] Scope matches the approved slice only.
- [ ] Security boundaries are respected: no renderer access to Node.js, filesystem, or SQLite.
- [ ] Business rules are implemented outside React components.
- [ ] No SQL appears in UI components.
- [ ] Privileged-process validation exists for renderer-provided data.
- [ ] Versioned migrations are present from day one and updated when schema changes.
- [ ] Monetary values use integer cents only.
- [ ] Percentage handling uses the approved exact representation.
- [ ] Critical operations use transactions where required.
- [ ] Historical sale snapshots are preserved where required.
- [ ] Audit logging exists for sensitive operations in the slice.
- [ ] Tests cover the slice according to the approved implementation plan.
- [ ] UX respects readability and safety rules from product docs.
- [ ] Documentation is updated if an approved design detail changed.
- [ ] If the slice includes Home, it matches the approved MVP operational scope: direct actions first, only the approved indicators, and no dashboard-style charts or decorative metrics.
- [ ] If the slice includes Home, the main actions remain usable even when one indicator fails to load.
- [ ] If the slice includes Home, indicator refresh happens on entering or returning to Home, without real-time updates, polling, or background processes.
- [ ] If the slice includes personalization, the entered personalization amount is treated as the additional amount charged to the buyer, remains optional, does not apply to clothing in MVP, and does not replace the base product percentage.
- [ ] If the slice includes personalization persistence, personalization amount uses integer cents, personalization percentage uses integer basis points, and historical values are preserved on sold-item snapshots and allocation history when applicable.
- [ ] If the slice includes Excel export, it behaves as an on-demand operational report, does not reintroduce mandatory month/year selection as the main export gate, and shows generation timestamp plus visible date/month context for interpretation.
- [ ] If the slice includes data retention-sensitive areas, it does not introduce age-based deletion for commercial database records.
- [ ] If the slice includes packaging, it ships only the files required to run the app.
- [ ] If the slice includes packaging, Windows delivery is validated on a clean machine before the slice is considered done.
- [ ] If the slice includes packaging, validation confirms shortcut launch, data persistence after closing, reinstall without deleting user data, and documented uninstall behavior regarding user data.
- [ ] Human review confirms the slice matches the approved docs.

## Explicitly Not Done
- Hidden scope expansion beyond the approved slice.
- Unapproved library changes.
- Shipping code before open blocking decisions are resolved or explicitly deferred.
- Replacing documented business rules with convenience behavior.
- Treating Home as an analytical dashboard instead of the approved operational entry screen.
- Reintroducing a six-month or other age-based deletion rule for commercial data.
